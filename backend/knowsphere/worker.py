"""Postgres queue: skip-locked claims, expiring leases, fencing and chunk checkpoints."""

import asyncio
import contextlib
import logging
import signal
import socket
import uuid

from . import ai, db
from .config import settings
from .events import emit
from .text import canonical, chunk_text, quote_present

log = logging.getLogger("knowsphere.worker")


class LeaseLost(Exception):
    pass


async def claim():
    async with db.database().connection() as conn, conn.transaction():
        exhausted = await (
            await conn.execute("""UPDATE knowsphere.documents
            SET status='failed',lease_token=NULL,lease_until=NULL,updated_at=now(),
                error='The worker was interrupted repeatedly. Retry this document to resume its checkpoints.'
            WHERE status='processing' AND lease_until<now() AND attempts>=3 RETURNING id,space_id""")
        ).fetchall()
        for row in exhausted:
            await emit(
                conn, row["space_id"], "document.updated", {"document_id": str(row["id"]), "status": "failed"}
            )
        return await (
            await conn.execute("""UPDATE knowsphere.documents SET status='processing', attempts=attempts+1,
        lease_token=gen_random_uuid(), lease_until=now()+interval '150 seconds', updated_at=now(), error=NULL
        WHERE id=(SELECT id FROM knowsphere.documents WHERE
        (status='queued' AND available_at<=now()) OR
        (status='processing' AND lease_until<now())
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *""")
        ).fetchone()


async def check_lease(conn, job):
    row = await (
        await conn.execute(
            """SELECT id FROM knowsphere.documents WHERE id=%s AND lease_token=%s
        AND status='processing' AND lease_until>now() FOR UPDATE""",
            (job["id"], job["lease_token"]),
        )
    ).fetchone()
    if not row:
        raise LeaseLost()


async def renew(job):
    while True:
        await asyncio.sleep(20)
        await db.execute(
            """UPDATE knowsphere.documents SET lease_until=now()+interval '150 seconds'
            WHERE id=%s AND lease_token=%s AND status='processing'""",
            (job["id"], job["lease_token"]),
        )


async def save_extraction(job, chunk, graph: ai.Extraction):
    async with db.database().connection() as conn, conn.transaction():
        await check_lease(conn, job)
        names = {}
        for entity in graph.entities:
            key = canonical(entity.name)
            if not key or not quote_present(entity.evidence, chunk["content"]):
                continue
            row = await (
                await conn.execute(
                    """INSERT INTO knowsphere.entities(space_id,name,canonical,kind)
                VALUES (%s,%s,%s,%s) ON CONFLICT(space_id,canonical) DO UPDATE SET canonical=EXCLUDED.canonical
                RETURNING id""",
                    (job["space_id"], entity.name.strip(), key, entity.kind),
                )
            ).fetchone()
            names[key] = row["id"]
            await conn.execute(
                """INSERT INTO knowsphere.mentions(entity_id,chunk_id,description,evidence) VALUES (%s,%s,%s,%s)
                ON CONFLICT(entity_id,chunk_id) DO NOTHING""",
                (row["id"], chunk["id"], entity.description, entity.evidence),
            )
        for relation in graph.relationships:
            source, target = names.get(canonical(relation.source)), names.get(canonical(relation.target))
            if (
                not source
                or not target
                or source == target
                or not quote_present(relation.evidence, chunk["content"])
            ):
                continue
            await conn.execute(
                """INSERT INTO knowsphere.relationships(source_id,target_id,chunk_id,label,evidence,confidence)
                VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                (source, target, chunk["id"], relation.label, relation.evidence, relation.confidence),
            )
        await conn.execute("UPDATE knowsphere.chunks SET processed=true WHERE id=%s", (chunk["id"],))
        row = await (
            await conn.execute(
                """SELECT count(*) FILTER(WHERE processed) AS done,count(*) AS total
            FROM knowsphere.chunks WHERE document_id=%s""",
                (job["id"],),
            )
        ).fetchone()
        progress = min(95, int(95 * row["done"] / max(1, row["total"])))
        await conn.execute(
            "UPDATE knowsphere.documents SET progress=%s,updated_at=now() WHERE id=%s", (progress, job["id"])
        )
        await emit(
            conn,
            job["space_id"],
            "document.updated",
            {
                "document_id": str(job["id"]),
                "title": job["title"],
                "stage": "checkpoint",
                "progress": progress,
                "chunks_done": row["done"],
                "chunks_total": row["total"],
            },
        )


async def process(job):
    async with db.database().connection() as conn, conn.transaction():
        await check_lease(conn, job)
        for ordinal, content in enumerate(chunk_text(job["content"])):
            await conn.execute(
                """INSERT INTO knowsphere.chunks(document_id,ordinal,content) VALUES (%s,%s,%s)
                ON CONFLICT(document_id,ordinal) DO NOTHING""",
                (job["id"], ordinal, content),
            )
        await emit(
            conn,
            job["space_id"],
            "document.updated",
            {
                "document_id": str(job["id"]),
                "title": job["title"],
                "status": "processing",
                "stage": "chunking",
            },
        )
    chunks = await db.fetch(
        "SELECT * FROM knowsphere.chunks WHERE document_id=%s AND NOT processed ORDER BY ordinal",
        (job["id"],),
    )
    for chunk in chunks:
        async with db.database().connection() as conn, conn.transaction():
            await check_lease(conn, job)
            await emit(
                conn,
                job["space_id"],
                "document.updated",
                {
                    "document_id": str(job["id"]),
                    "title": job["title"],
                    "stage": "extracting",
                    "chunk": chunk["ordinal"] + 1,
                },
            )
        graph = await ai.extract(chunk["content"])
        await save_extraction(job, chunk, graph)
    async with db.database().connection() as conn, conn.transaction():
        await check_lease(conn, job)
        await conn.execute(
            """UPDATE knowsphere.documents SET status='ready',progress=100,error=NULL,
            lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=%s""",
            (job["id"],),
        )
        await emit(
            conn,
            job["space_id"],
            "graph.updated",
            {"document_id": str(job["id"]), "title": job["title"], "status": "ready", "stage": "published"},
        )


async def fail(job, exc):
    retry = isinstance(exc, ai.AIError) and exc.retryable and job["attempts"] < 3
    error = (
        str(exc)
        if isinstance(exc, ai.AIError)
        else "Document processing failed. Please retry or check server logs."
    )
    delay = max(30 * 2 ** job["attempts"], exc.retry_after if isinstance(exc, ai.AIError) else 60)
    async with db.database().connection() as conn, conn.transaction():
        await check_lease(conn, job)
        await conn.execute(
            """UPDATE knowsphere.documents SET status=%s,error=%s,lease_token=NULL,lease_until=NULL,
            available_at=now()+(%s * interval '1 second'),updated_at=now() WHERE id=%s""",
            ("queued" if retry else "failed", error, delay, job["id"]),
        )
        await emit(
            conn,
            job["space_id"],
            "document.updated",
            {
                "document_id": str(job["id"]),
                "title": job["title"],
                "retrying": retry,
                "status": "queued" if retry else "failed",
            },
        )


async def heartbeat(worker_id, stop):
    while not stop.is_set():
        await db.execute(
            """INSERT INTO knowsphere.worker_health(id) VALUES (%s)
            ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()""",
            (worker_id,),
        )
        # Retention is independent of API traffic. No document or message content is logged.
        await db.execute("DELETE FROM knowsphere.rate_limits WHERE expires_at<now()")
        await db.execute("DELETE FROM knowsphere.sessions WHERE expires_at<now()")
        await db.execute("DELETE FROM knowsphere.events WHERE created_at<now()-interval '7 days'")
        await db.execute("DELETE FROM knowsphere.worker_health WHERE heartbeat_at<now()-interval '1 day'")
        try:
            await asyncio.wait_for(stop.wait(), timeout=15)
        except TimeoutError:
            pass


async def run():
    logging.basicConfig(level=settings().log_level, format="%(asctime)s %(levelname)s %(message)s")
    await db.open_pool()
    stop = asyncio.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        asyncio.get_running_loop().add_signal_handler(sig, stop.set)
    monitor = asyncio.create_task(heartbeat(f"{socket.gethostname()}:{uuid.uuid4()}", stop))
    try:
        while not stop.is_set():
            if monitor.done():
                await monitor  # Exit and let Railway restart if heartbeats fail.
            job = await claim()
            if not job:
                try:
                    await asyncio.wait_for(stop.wait(), settings().worker_poll_seconds)
                except TimeoutError:
                    pass
                continue
            lease = asyncio.create_task(renew(job))
            try:
                await process(job)
            except LeaseLost:
                log.info("Lease released for document %s", job["id"])
            except Exception as exc:
                log.error("Processing failed for document %s (%s)", job["id"], type(exc).__name__)
                with contextlib.suppress(LeaseLost):
                    await fail(job, exc)
            finally:
                lease.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await lease
    finally:
        monitor.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await monitor
        await db.close_pool()


if __name__ == "__main__":
    asyncio.run(run())
