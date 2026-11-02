"""Run once as Railway's pre-deploy command; serialized with a Postgres lock."""

import asyncio
from pathlib import Path

import psycopg

from .config import settings


async def migrate():
    if not settings().database_url:
        raise RuntimeError("Set DATABASE_URL before running migrations")
    async with await psycopg.AsyncConnection.connect(settings().database_url) as conn:
        async with conn.transaction():
            await conn.execute("SELECT pg_advisory_xact_lock(872901)")
            await conn.execute("CREATE SCHEMA IF NOT EXISTS knowsphere")
            await conn.execute(
                "CREATE TABLE IF NOT EXISTS knowsphere.schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())"
            )
            for path in sorted((Path(__file__).parent.parent / "migrations").glob("*.sql")):
                row = await (
                    await conn.execute(
                        "SELECT 1 FROM knowsphere.schema_migrations WHERE name=%s", (path.name,)
                    )
                ).fetchone()
                if not row:
                    await conn.execute(path.read_text())
                    await conn.execute(
                        "INSERT INTO knowsphere.schema_migrations(name) VALUES (%s)", (path.name,)
                    )
                    print(f"Applied {path.name}")


if __name__ == "__main__":
    asyncio.run(migrate())
