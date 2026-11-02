import os

import httpx
import psycopg
import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def client(monkeypatch):
    url = os.getenv("TEST_DATABASE_URL", "")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a disposable local PostgreSQL database")
    # Integration tests erase only their explicitly supplied local test schema.
    from urllib.parse import urlsplit

    parsed = urlsplit(url)
    if parsed.hostname not in {"localhost", "127.0.0.1"} or not parsed.path.endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must point to a local database named *_test")
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:5173")
    from knowsphere.config import settings

    settings.cache_clear()
    async with await psycopg.AsyncConnection.connect(url, autocommit=True) as conn:
        await conn.execute("DROP SCHEMA IF EXISTS knowsphere CASCADE")
    from knowsphere.migrate import migrate

    await migrate()
    from knowsphere.main import app, lifespan

    async with lifespan(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://localhost",
            headers={"X-KnowSphere-Client": "web", "Origin": "http://localhost:5173"},
        ) as session:
            yield session
    settings.cache_clear()
