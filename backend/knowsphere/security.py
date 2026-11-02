import hashlib
import secrets
import time

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool

from . import db
from .config import settings

hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))
COOKIE = "ks_session"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


async def rate_limit(key: str, limit: int, seconds: int = 60):
    bucket = int(time.time()) // seconds
    row = await db.one(
        """INSERT INTO knowsphere.rate_limits(key, expires_at) VALUES (%s, now() + (%s * interval '1 second'))
        ON CONFLICT(key) DO UPDATE SET count=rate_limits.count+1 RETURNING count""",
        (digest(f"{key}:{bucket}"), seconds * 2),
    )
    if row["count"] > limit:
        raise HTTPException(
            429, "Too many requests. Please try again shortly.", headers={"Retry-After": str(seconds)}
        )


async def hash_password(password: str) -> str:
    return await run_in_threadpool(hasher.hash, password)


async def verify_password(stored: str, password: str) -> bool:
    try:
        return await run_in_threadpool(hasher.verify, stored, password)
    except (VerificationError, InvalidHashError):
        return False


async def create_session(user_id, response: Response):
    token = secrets.token_urlsafe(48)
    await db.execute(
        "INSERT INTO knowsphere.sessions(token_hash,user_id,expires_at) VALUES (%s,%s,now()+(%s * interval '1 day'))",
        (digest(token), user_id, settings().session_days),
    )
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        secure=settings().cookie_secure,
        samesite="lax",
        max_age=settings().session_days * 86400,
        path="/api",
    )


async def current_user(request: Request):
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Please sign in to continue.")
    row = await db.one(
        """SELECT u.id,u.email,u.name FROM knowsphere.sessions s JOIN knowsphere.users u ON u.id=s.user_id
        WHERE s.token_hash=%s AND s.expires_at>now()""",
        (digest(token),),
    )
    if not row:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    return row


async def owned_space(space_id, user):
    row = await db.one("SELECT * FROM knowsphere.spaces WHERE id=%s AND owner_id=%s", (space_id, user["id"]))
    if not row:
        raise HTTPException(404, "Knowledge space not found.")
    return row
