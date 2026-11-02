from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import settings

pool: AsyncConnectionPool | None = None


async def open_pool():
    global pool
    if not settings().database_url:
        raise RuntimeError("DATABASE_URL is required. Configure backend/.env with your Neon connection.")
    pool = AsyncConnectionPool(
        settings().database_url,
        min_size=1,
        max_size=8,
        open=False,
        timeout=15,
        kwargs={"row_factory": dict_row, "autocommit": True, "prepare_threshold": None},
        check=AsyncConnectionPool.check_connection,
    )
    await pool.open(wait=True, timeout=20)


def database() -> AsyncConnectionPool:
    if pool is None:
        raise RuntimeError("Database pool has not been started")
    return pool


async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None


async def fetch(sql: str, params=()):
    async with database().connection() as conn:
        return await (await conn.execute(sql, params)).fetchall()


async def one(sql: str, params=()):
    async with database().connection() as conn:
        return await (await conn.execute(sql, params)).fetchone()


async def execute(sql: str, params=()):
    async with database().connection() as conn:
        return await conn.execute(sql, params)
