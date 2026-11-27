import asyncio
import math

import pytest

from knowsphere.config import settings
from knowsphere.ml import MLUnavailable, PassageRanker, ranker


@pytest.fixture
def model(monkeypatch):
    monkeypatch.setattr(settings(), "ml_enabled", True)
    ranker.load()
    return ranker


def test_real_neural_model_prioritizes_an_answer_over_keyword_repetition(model):
    rows = [
        {
            "id": "keywords",
            "content": "Password password recovery accounts passwords are categories in the product dashboard.",
        },
        {
            "id": "answer",
            "content": "To regain access after forgetting your password, request a reset link at the sign-in page.",
        },
    ]
    results = model.rank("How can I recover my account if I forgot my password?", rows)
    assert results[0]["id"] == "answer"
    assert results[0]["relevance_score"] > results[1]["relevance_score"]
    assert all(math.isfinite(row["relevance_score"]) for row in results)
    assert all(row["retrieval_model"] == "Xenova/ms-marco-MiniLM-L-6-v2" for row in results)
    assert "retrieval_model" not in rows[0]  # Never mutate shared source records.


def test_long_chunk_tail_is_scored_and_returned_as_exact_original_text(model):
    prefix = "The telescope observes distant planets and records atmospheric measurements. " * 65
    source = (
        prefix + "To regain access after forgetting your password, request a reset link at the sign-in page."
    )
    result = model.rank(
        "How do I recover access after forgetting a password?", [{"id": "long", "content": source}]
    )[0]
    assert "reset link" in result["content"]
    assert result["match_end"] == len(source)
    assert result["content"] == source[result["match_start"] : result["match_end"]]
    assert result["match_start"] > 0


def test_unicode_windows_preserve_source_offsets(model):
    source = "Café research — naïve assumptions fail. " * 100 + "Café access requires a password reset link."
    result = model.rank("How do I reset my café password?", [{"id": "unicode", "content": source}])[0]
    assert "password reset link" in result["content"]
    assert result["content"] == source[result["match_start"] : result["match_end"]]


def test_corrupt_artifact_is_rejected_without_loading_or_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(settings(), "ml_model_dir", tmp_path)
    (tmp_path / "model.onnx").write_bytes(b"untrusted model")
    isolated = PassageRanker()
    with pytest.raises(MLUnavailable, match="SHA-256"):
        isolated.load()
    assert not isolated.status()["ready"]


def test_missing_runtime_never_substitutes_lexical_results():
    with pytest.raises(MLUnavailable, match="unavailable"):
        PassageRanker().rank("question", [{"id": "source", "content": "source text"}])


def test_explicit_operator_disable_is_reported(monkeypatch):
    monkeypatch.setattr(settings(), "ml_enabled", False)
    isolated = PassageRanker()
    isolated.load()
    assert isolated.status()["enabled"] is False
    assert isolated.status()["ready"] is False
    rows = [{"id": "a", "content": "real source"}]
    assert isolated.rank("question", rows) == rows


async def test_concurrent_inference_keeps_query_results_separate(model):
    rows = [
        {"id": "storage", "content": "PostgreSQL stores documents in a relational database."},
        {"id": "access", "content": "Reset a forgotten password using the sign-in reset link."},
    ]
    storage, access = await asyncio.gather(
        model.rerank("Where are documents stored?", rows),
        model.rerank("How do I reset a forgotten password?", rows),
    )
    assert storage[0]["id"] == "storage"
    assert access[0]["id"] == "access"


def test_evaluation_metrics_and_database_guard():
    from knowsphere.evaluate_ml import local_test_url, metrics

    assert metrics(["b", "a", "b", "c"], {"a", "c"}) == {"hit_at_1": 0.0, "recall_at_8": 1.0, "mrr_at_8": 0.5}
    for value in [
        "",
        "postgresql://user@remote.example/test_test",
        "postgresql://localhost/production",
        "postgresql://localhost/safe_test?hostaddr=192.0.2.1",
        "postgresql://localhost/safe_test?dbname=production",
    ]:
        with pytest.raises(ValueError, match="LOCAL"):
            local_test_url(value)
    assert local_test_url("postgresql://localhost/safe_test").endswith("safe_test")


def test_inference_admission_is_bounded(model):
    for _ in range(4):
        assert model.pending.acquire(blocking=False)
    try:
        with pytest.raises(MLUnavailable, match="busy"):
            model.rank("password", [{"id": "source", "content": "Password reset instructions."}])
    finally:
        for _ in range(4):
            model.pending.release()
