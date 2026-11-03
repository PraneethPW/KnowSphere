import uuid

import httpx
import pytest

from knowsphere import db
from knowsphere.ai import Extraction
from knowsphere.main import app, enqueue
from knowsphere.worker import LeaseLost, check_lease, claim, save_extraction


async def register(client, email="owner@example.com"):
    r = await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Test Researcher", "password": "A-test-only-password-1234"},
    )
    assert r.status_code == 201, r.text
    return (await client.get("/api/spaces")).json()[0]["id"]


async def test_auth_session_and_revocation(client):
    await register(client)
    assert (await client.get("/api/auth/me")).status_code == 200
    cookie = client.cookies.get("ks_session")
    stored = await db.one("SELECT token_hash FROM knowsphere.sessions")
    assert stored["token_hash"] != cookie
    assert "HttpOnly" in client.cookies.jar._cookies["localhost.local"]["/api"]["ks_session"]._rest
    await client.post("/api/auth/logout-all", json={})
    assert (await client.get("/api/auth/me")).status_code == 401
    r = await client.post(
        "/api/auth/login", json={"email": "owner@example.com", "password": "A-test-only-password-1234"}
    )
    assert r.status_code == 200
    r = await client.post(
        "/api/auth/login", json={"email": "owner@example.com", "password": "incorrect-password"}
    )
    assert r.status_code == 401


async def test_request_boundaries_and_no_fake_ai_fallback(client):
    space = await register(client)
    r = await client.post(
        f"/api/spaces/{space}/documents/text",
        json={
            "title": "Notes",
            "content": "A real source has more than forty characters of meaningful text.",
        },
    )
    assert r.status_code == 503
    assert (await client.get(f"/api/spaces/{space}/graph")).json()["nodes"] == []
    r = await client.post(
        "/api/spaces", json={"name": "Injected"}, headers={"Origin": "https://attacker.example"}
    )
    assert r.status_code == 403
    r = await client.post("/api/spaces", json={"name": "Injected"}, headers={"X-KnowSphere-Client": ""})
    assert r.status_code == 403
    r = await client.post("/api/auth/register", json={"email": "other@example.com", "password": "short"})
    assert r.status_code == 422 and "short" not in r.text


async def test_all_resource_boundaries_reject_other_owner(client):
    space = await register(client)
    doc = await enqueue(
        space,
        "Owner notes",
        "Neon stores relational data. KnowSphere uses Neon for persistent knowledge storage.",
        "text",
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://localhost", headers=dict(client.headers)
    ) as other:
        await register(other, "different@example.com")
        for path in [
            "overview",
            "documents",
            "graph",
            "export",
            "conversations",
            "search?q=Neon",
            f"documents/{doc['id']}",
            f"entities/{uuid.uuid4()}",
        ]:
            assert (await other.get(f"/api/spaces/{space}/{path}")).status_code == 404
        assert (await other.delete(f"/api/spaces/{space}/documents/{doc['id']}")).status_code == 404
        assert (
            await other.post(f"/api/spaces/{space}/chat", json={"message": "Tell me about Neon"})
        ).status_code == 404
    assert (await client.get(f"/api/spaces/{space}/documents")).json()[0]["title"] == "Owner notes"


async def test_durable_claim_fencing_evidence_and_cascade(client):
    space = await register(client)
    source = "KnowSphere uses Neon. Neon stores relational data for KnowSphere."
    doc = await enqueue(space, "Technical notes", source, "text")
    job = await claim()
    assert job["id"] == doc["id"]
    assert await claim() is None
    chunk = await db.one(
        "INSERT INTO knowsphere.chunks(document_id,ordinal,content) VALUES (%s,0,%s) RETURNING *",
        (doc["id"], source),
    )
    # Test extraction fixtures validate storage rules; no provider is substituted in the application.
    graph = Extraction.model_validate(
        {
            "entities": [
                {
                    "name": "KnowSphere",
                    "kind": "technology",
                    "description": "A knowledge platform",
                    "evidence": "KnowSphere uses Neon.",
                },
                {
                    "name": "Neon",
                    "kind": "technology",
                    "description": "Relational storage",
                    "evidence": "Neon stores relational data",
                },
                {
                    "name": "Unsupported",
                    "kind": "concept",
                    "description": "Not in source",
                    "evidence": "Unsupported fact not in source",
                },
            ],
            "relationships": [
                {
                    "source": "KnowSphere",
                    "target": "Neon",
                    "label": "uses",
                    "evidence": "KnowSphere uses Neon.",
                    "confidence": 0.9,
                },
                {
                    "source": "Neon",
                    "target": "KnowSphere",
                    "label": "invented",
                    "evidence": "Unstated supporting quote",
                    "confidence": 1,
                },
            ],
        }
    )
    await save_extraction(job, chunk, graph)
    assert len(await db.fetch("SELECT * FROM knowsphere.entities")) == 2
    assert len(await db.fetch("SELECT * FROM knowsphere.relationships")) == 1
    # Cancellation invalidates the worker token before a stale worker can commit.
    assert (
        await client.post(f"/api/spaces/{space}/documents/{doc['id']}/cancel", json={})
    ).status_code == 200
    async with db.database().connection() as conn, conn.transaction():
        with pytest.raises(LeaseLost):
            await check_lease(conn, job)
    assert (await client.get(f"/api/spaces/{space}/graph")).json()["nodes"] == []
    await db.execute("UPDATE knowsphere.documents SET status='ready' WHERE id=%s", (doc["id"],))
    data = (await client.get(f"/api/spaces/{space}/graph")).json()
    assert len(data["nodes"]) == 2 and len(data["links"]) == 1
    assert (await client.get(f"/api/spaces/{space}/search?q=Neon")).json()
    assert (await client.delete(f"/api/spaces/{space}/documents/{doc['id']}")).status_code == 204
    assert not await db.fetch("SELECT * FROM knowsphere.relationships")
    assert not await db.fetch("SELECT * FROM knowsphere.entities")


async def test_repeated_worker_interruptions_reach_retryable_failure(client):
    space = await register(client)
    doc = await enqueue(
        space,
        "Recovery notes",
        "KnowSphere uses Neon for persistent graph storage. Its ingestion worker is durable.",
        "text",
    )
    await db.execute(
        """UPDATE knowsphere.documents SET status='processing',attempts=3,
        lease_token=gen_random_uuid(),lease_until=now()-interval '1 minute' WHERE id=%s""",
        (doc["id"],),
    )
    assert await claim() is None
    row = await db.one("SELECT status,error FROM knowsphere.documents WHERE id=%s", (doc["id"],))
    assert row["status"] == "failed" and "interrupted" in row["error"]


async def test_operations_history_checkpoints_and_cursor_are_owner_scoped(client):
    space = await register(client)
    doc = await enqueue(space, "Checkpoint notes", "KnowSphere uses Neon for durable graph storage.", "text")
    job = await claim()
    chunk = await db.one(
        "INSERT INTO knowsphere.chunks(document_id,ordinal,content) VALUES (%s,0,%s) RETURNING *",
        (doc["id"], "KnowSphere uses Neon for durable graph storage."),
    )
    await save_extraction(job, chunk, Extraction(entities=[], relationships=[]))
    telemetry = (await client.get(f"/api/spaces/{space}/operations")).json()
    assert len(telemetry) == 1
    assert telemetry[0]["chunks_done"] == telemetry[0]["chunks_total"] == 1
    assert telemetry[0]["verified_relationships"] == 0
    events = (await client.get(f"/api/spaces/{space}/activity?limit=1")).json()
    assert len(events) == 1 and events[0]["payload"]["stage"] == "checkpoint"
    previous = (await client.get(f"/api/spaces/{space}/activity?before={events[0]['id']}")).json()
    assert len(previous) == 1 and previous[0]["kind"] == "document.created"
    assert previous[0]["id"] < events[0]["id"]
    assert (await client.get(f"/api/spaces/{space}/activity?limit=1000")).status_code == 422
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://localhost", headers=dict(client.headers)
    ) as other:
        other_space = await register(other, "second-operator@example.com")
        for path in ["operations", "activity?limit=1", f"activity?before={events[0]['id']}"]:
            assert (await other.get(f"/api/spaces/{space}/{path}")).status_code == 404
        assert (await other.get(f"/api/spaces/{other_space}/operations")).json() == []
        assert (await other.get(f"/api/spaces/{other_space}/activity")).json() == []


async def test_natural_question_retrieval_broadens_terms_without_inventing_context(client):
    space = await register(client)
    content = "Durable ingestion uses database leases and checkpoints to recover interrupted jobs."
    doc = await enqueue(space, "Recovery protocol", content, "text")
    await db.execute("UPDATE knowsphere.documents SET status='ready' WHERE id=%s", (doc["id"],))
    await db.execute(
        "INSERT INTO knowsphere.chunks(document_id,ordinal,content,processed) VALUES (%s,0,%s,true)",
        (doc["id"], content),
    )
    r = await client.get(
        f"/api/spaces/{space}/search",
        params={"q": "How can a durable pipeline recover after a process stops?"},
    )
    assert r.status_code == 200 and r.json()[0]["content"] == content
    assert (await client.get(f"/api/spaces/{space}/search?q=purple+astronomy")).json() == []
    assert (await client.get(f"/api/spaces/{space}/search?q=the+and+or")).json() == []


@pytest.mark.parametrize("repair_succeeds", [True, False])
async def test_citation_revision_persists_only_valid_final_answer(client, monkeypatch, repair_succeeds):
    from knowsphere import ai
    from knowsphere.config import settings

    space = await register(client)
    content = "Neon stores the knowledge documents in PostgreSQL."
    doc = await enqueue(space, "Storage notes", content, "text")
    await db.execute("UPDATE knowsphere.documents SET status='ready' WHERE id=%s", (doc["id"],))
    await db.execute(
        "INSERT INTO knowsphere.chunks(document_id,ordinal,content,processed) VALUES (%s,0,%s,true)",
        (doc["id"], content),
    )
    monkeypatch.setattr(settings(), "openrouter_api_key", "isolated-test-only")
    calls = []

    # Isolated provider fixtures exercise persistence and repair; no runtime fallback is installed.
    async def fixture_answer(prompt):
        calls.append(prompt)
        yield {"model": "isolated-fixture:free"}
        if len(calls) == 1:
            yield {"token": "Uncited draft [999]."}
        else:
            yield {
                "token": "Neon stores documents in PostgreSQL [1]." if repair_succeeds else "Still uncited."
            }

    monkeypatch.setattr(ai, "stream_answer", fixture_answer)
    r = await client.post(f"/api/spaces/{space}/chat", json={"message": "Where does Neon store documents?"})
    assert r.status_code == 200 and len(calls) == 2
    assert r.text.count("event: reset") == 1
    assert "repairing" in r.text
    messages = await db.fetch("SELECT role,content FROM knowsphere.messages ORDER BY created_at,id")
    assert len(messages) == (2 if repair_succeeds else 1)
    if repair_succeeds:
        assert messages[-1]["content"] == "Neon stores documents in PostgreSQL [1]."
        assert "event: done" in r.text
    else:
        assert "event: error" in r.text and "event: done" not in r.text
    assert not (await db.one("SELECT run_token FROM knowsphere.conversations"))["run_token"]
