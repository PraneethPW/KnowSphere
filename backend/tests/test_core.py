import pytest
from pydantic import ValidationError

from knowsphere.ai import Extraction
from knowsphere.config import Settings
from knowsphere.discovery import analyze, used_citations
from knowsphere.text import canonical, chunk_text, parse_upload, quote_present


def test_canonical_resolution_preserves_meaningful_unicode():
    assert canonical("  React.js  ") == canonical("REACT JS")
    assert canonical("ＡＩ — Research") == "ai research"
    assert canonical("Café") == "café"


def test_evidence_must_be_present_not_generated():
    assert quote_present("Neon   stores\n data", "KnowSphere uses Neon stores data for persistence.")
    assert not quote_present("Neon stores encrypted files", "Neon stores relational data.")
    assert not quote_present("", "Document content")


def test_chunks_are_bounded_overlap_and_reach_end():
    source = " ".join(f"sentence{i}" for i in range(2000))
    chunks = chunk_text(source)
    assert len(chunks) > 1
    assert all(0 < len(chunk) <= 6000 for chunk in chunks)
    assert chunks[0].startswith("sentence0")
    assert chunks[-1].endswith("sentence1999")
    for first, second in zip(chunks, chunks[1:]):
        assert first[-350:-20] in second[:450]
    with pytest.raises(ValueError):
        chunk_text(source, size=10, overlap=20)


def test_upload_rejects_invalid_formats_and_no_text():
    with pytest.raises(ValueError, match="valid PDF"):
        parse_upload(b"not a PDF", "paper.pdf", 120000)
    with pytest.raises(ValueError, match="UTF-8"):
        parse_upload(b"\xff" * 100, "paper.txt", 120000)
    with pytest.raises(ValueError, match="40 characters"):
        parse_upload(b"too short", "paper.md", 120000)
    with pytest.raises(ValueError, match="Upload a PDF"):
        parse_upload(b"content", "paper.exe", 120000)
    source = "Real document content for validating the upload parser."
    assert parse_upload(source.encode(), "notes.txt", 120000) == (source, "txt")


def test_free_models_and_production_tls_are_enforced():
    with pytest.raises(ValidationError, match="free model"):
        Settings(_env_file=None, openrouter_model="provider/paid-model")
    with pytest.raises(ValidationError, match="free model"):
        Settings(_env_file=None, openrouter_extraction_model="provider/paid-model")
    with pytest.raises(ValidationError, match="free model"):
        Settings(_env_file=None, openrouter_extraction_fallbacks="provider/paid-model")
    with pytest.raises(ValidationError, match="free model"):
        Settings(_env_file=None, openrouter_fallbacks="provider/paid-model")
    with pytest.raises(ValidationError, match="secure cookies"):
        Settings(_env_file=None, app_env="production")
    with pytest.raises(ValidationError, match="TLS PostgreSQL"):
        Settings(
            _env_file=None,
            app_env="production",
            cookie_secure=True,
            allowed_origins="https://app.example.com",
            database_url="postgresql://localhost/db?sslmode=disable",
        )


def test_graph_algorithms_handle_empty_isolated_and_zero_weight_edges():
    assert analyze([], [])["communities"] == 0
    isolated = [{"id": "a"}, {"id": "b"}]
    result = analyze(isolated, [])
    assert result["components"] == 2
    assert sum(n["centrality"] for n in isolated) == 1
    result = analyze([{"id": "a"}, {"id": "b"}], [{"source": "a", "target": "b", "confidence": 0}])
    assert result["communities"] == 1
    assert all(n["degree"] == 1 for n in result["nodes"])


def test_extraction_validates_provider_output():
    assert Extraction.model_validate({"entities": [], "relationships": []}).entities == []
    with pytest.raises(ValidationError):
        Extraction.model_validate(
            {
                "entities": [{"name": "AI", "kind": "made-up", "description": "x", "evidence": "xxx"}],
                "relationships": [],
            }
        )


def test_only_referenced_citations_are_saved():
    citations = [{"index": 1}, {"index": 2}, {"index": 3}]
    assert used_citations("Supported [1] and [3]. Repeated [1].", citations) == [citations[0], citations[2]]


async def test_upload_parser_uses_isolated_process():
    from knowsphere.parser_process import parse_isolated

    source = "KnowSphere AI uses Neon PostgreSQL for persistent knowledge graph storage."
    content, format = await parse_isolated(source.encode(), "requirements.txt", 120000)
    assert content == source and format == "txt"
    with pytest.raises(ValueError, match="valid PDF"):
        await parse_isolated(b"This is not a PDF.", "file.pdf", 120000)


def test_extraction_requires_relationship_confidence_and_rejects_extra_fields():
    relation = {
        "source": "KnowSphere",
        "target": "Neon",
        "label": "uses",
        "evidence": "KnowSphere uses Neon.",
    }
    with pytest.raises(ValidationError, match="confidence"):
        Extraction.model_validate({"entities": [], "relationships": [relation]})
    with pytest.raises(ValidationError, match="Extra inputs"):
        Extraction.model_validate({"entities": [], "relationships": [], "invented": True})
