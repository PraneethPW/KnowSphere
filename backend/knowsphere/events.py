import json

from psycopg.types.json import Jsonb


async def emit(conn, space_id, kind: str, payload: dict):
    await conn.execute(
        "INSERT INTO knowsphere.events(space_id,kind,payload) VALUES (%s,%s,%s)",
        (space_id, kind, Jsonb(payload)),
    )


def sse(kind: str, payload, event_id=None) -> str:
    prefix = f"id: {event_id}\n" if event_id is not None else ""
    return f"{prefix}event: {kind}\ndata: {json.dumps(payload, default=str, ensure_ascii=False)}\n\n"
