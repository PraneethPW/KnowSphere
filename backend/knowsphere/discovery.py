import asyncio
import re

import networkx as nx

from . import db
from .text import canonical


async def overview(space_id):
    stats = await db.one(
        """SELECT count(*) AS documents,
        count(*) FILTER(WHERE status='ready') AS ready_documents,
        count(*) FILTER(WHERE status IN ('queued','processing')) AS active_jobs,
        count(*) FILTER(WHERE status='failed') AS failed_jobs,
        coalesce(sum(length(content)),0) AS characters
        FROM knowsphere.documents WHERE space_id=%s""",
        (space_id,),
    )
    stats.update(
        await db.one(
            """SELECT count(DISTINCT e.id) AS entities FROM knowsphere.entities e
        JOIN knowsphere.mentions m ON m.entity_id=e.id JOIN knowsphere.chunks c ON c.id=m.chunk_id
        JOIN knowsphere.documents d ON d.id=c.document_id WHERE e.space_id=%s AND d.status='ready'""",
            (space_id,),
        )
    )
    stats.update(
        await db.one(
            """SELECT count(*) AS relationships FROM knowsphere.relationships r
        JOIN knowsphere.chunks c ON c.id=r.chunk_id JOIN knowsphere.documents d ON d.id=c.document_id
        WHERE d.space_id=%s AND d.status='ready'""",
            (space_id,),
        )
    )
    stats["recent_activity"] = await db.fetch(
        """SELECT id,kind,payload,created_at FROM knowsphere.events
        WHERE space_id=%s ORDER BY id DESC LIMIT 15""",
        (space_id,),
    )
    stats["growth"] = await db.fetch(
        """SELECT date_trunc('day',created_at) AS day, count(*) AS count
        FROM knowsphere.documents WHERE space_id=%s GROUP BY 1 ORDER BY 1 DESC LIMIT 14""",
        (space_id,),
    )
    return stats


def analyze(nodes, links):
    graph = nx.Graph()
    graph.add_nodes_from(str(n["id"]) for n in nodes)
    for link in links:
        graph.add_edge(str(link["source"]), str(link["target"]), weight=max(0.001, link["confidence"]))
    # Degree and PageRank are graph statistics, not asserted model confidence.
    ranks = nx.pagerank(graph, weight="weight") if graph else {}
    communities = (
        list(nx.community.louvain_communities(graph, seed=42))
        if graph.number_of_edges()
        else [{n} for n in graph]
    )
    groups = {node: i for i, group in enumerate(communities) for node in group}
    for node in nodes:
        node["centrality"] = round(ranks.get(str(node["id"]), 0), 6)
        node["community"] = groups.get(str(node["id"]), 0)
        node["degree"] = graph.degree(str(node["id"]))
    return {
        "nodes": nodes,
        "links": links,
        "communities": len(communities),
        "components": nx.number_connected_components(graph) if graph else 0,
    }


async def graph_data(space_id, limit=600):
    nodes = await db.fetch(
        """SELECT e.id,e.name,e.kind,count(*) AS mentions FROM knowsphere.entities e
        JOIN knowsphere.mentions m ON m.entity_id=e.id JOIN knowsphere.chunks c ON c.id=m.chunk_id
        JOIN knowsphere.documents d ON d.id=c.document_id WHERE e.space_id=%s AND d.status='ready'
        GROUP BY e.id ORDER BY count(*) DESC,e.name LIMIT %s""",
        (space_id, limit),
    )
    ids = [n["id"] for n in nodes]
    links = (
        await db.fetch(
            """SELECT r.id,r.source_id AS source,r.target_id AS target,r.label,
        r.evidence,r.confidence,d.id AS document_id,d.title FROM knowsphere.relationships r
        JOIN knowsphere.chunks c ON c.id=r.chunk_id JOIN knowsphere.documents d ON d.id=c.document_id
        WHERE d.space_id=%s AND d.status='ready' AND r.source_id=ANY(%s::uuid[]) AND r.target_id=ANY(%s::uuid[])
        ORDER BY r.confidence DESC,r.id LIMIT 4000""",
            (space_id, ids, ids),
        )
        if ids
        else []
    )
    data = await asyncio.to_thread(analyze, nodes, links)
    stats = await overview(space_id)
    data["truncated"] = stats["entities"] > len(nodes) or stats["relationships"] > len(links)
    data["total_entities"] = stats["entities"]
    data["total_relationships"] = stats["relationships"]
    return data


async def retrieve(space_id, query: str, limit=8):
    # Indexed lexical seeds; joins always bind to the authorized space and ready documents.
    seeds = await db.fetch(
        """SELECT c.id,c.content,c.ordinal,d.id AS document_id,d.title,
        ts_rank_cd(c.search,websearch_to_tsquery('english',%s)) AS score
        FROM knowsphere.chunks c JOIN knowsphere.documents d ON d.id=c.document_id
        WHERE d.space_id=%s AND d.status='ready' AND c.search @@ websearch_to_tsquery('english',%s)
        ORDER BY score DESC,c.id LIMIT %s""",
        (query, space_id, query, limit),
    )
    if not seeds:
        # Natural questions rarely contain only words found together in a passage.
        # Broaden indexed lexemes only when the precise query found nothing. Build
        # the OR query from PostgreSQL's escaped/stemmed tsquery, never raw input.
        seeds = await db.fetch(
            """WITH q AS (SELECT to_tsquery('english',
              replace(plainto_tsquery('english',%s)::text,' & ',' | ')) AS terms)
            SELECT c.id,c.content,c.ordinal,d.id AS document_id,d.title,
              ts_rank_cd(c.search,q.terms,32) AS score
            FROM knowsphere.chunks c JOIN knowsphere.documents d ON d.id=c.document_id CROSS JOIN q
            WHERE d.space_id=%s AND d.status='ready' AND c.search @@ q.terms
            ORDER BY score DESC,c.id LIMIT %s""",
            (query, space_id, limit),
        )
    normalized = canonical(query)
    entity_ids = await db.fetch(
        """SELECT id FROM knowsphere.entities WHERE space_id=%s
        AND length(canonical)>2 AND strpos(%s,canonical)>0 LIMIT 10""",
        (space_id, normalized),
    )
    ids = [e["id"] for e in entity_ids]
    if seeds:
        extra = await db.fetch(
            "SELECT DISTINCT entity_id AS id FROM knowsphere.mentions WHERE chunk_id=ANY(%s::uuid[]) LIMIT 16",
            ([c["id"] for c in seeds[:3]],),
        )
        ids += [e["id"] for e in extra]
    if ids:
        related = await db.fetch(
            """SELECT DISTINCT c.id,c.content,c.ordinal,d.id AS document_id,d.title,0.0 AS score
            FROM knowsphere.relationships r JOIN knowsphere.chunks c ON c.id=r.chunk_id JOIN knowsphere.documents d ON d.id=c.document_id
            WHERE d.space_id=%s AND d.status='ready' AND (r.source_id=ANY(%s::uuid[]) OR r.target_id=ANY(%s::uuid[]))
            ORDER BY c.id LIMIT 6""",
            (space_id, ids, ids),
        )
        existing = {str(c["id"]) for c in seeds}
        seeds += [c for c in related if str(c["id"]) not in existing]
    return seeds[:12]


def used_citations(content: str, citations: list[dict]) -> list[dict]:
    refs = {int(n) for n in re.findall(r"\[(\d+)\]", content)}
    return [c for c in citations if c["index"] in refs]
