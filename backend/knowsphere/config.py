from functools import lru_cache
from urllib.parse import parse_qs, urlsplit

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "openrouter/free"
    openrouter_extraction_model: str = "dots-studio/dots-3-note-preview:free"
    openrouter_extraction_reasoning: bool = False
    openrouter_extraction_fallbacks: str = (
        "xingchen-agi/xing4.0-29b-a4b:free,nvidia/nemotron-3.5-super-vl:free"
    )
    app_env: str = "development"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cookie_secure: bool = False
    registration_enabled: bool = True
    session_days: int = Field(default=7, ge=1, le=30)
    max_upload_bytes: int = Field(default=10_000_000, ge=1024, le=20_000_000)
    max_document_chars: int = Field(default=120_000, ge=1000, le=500_000)
    max_documents_per_space: int = Field(default=200, ge=1, le=1000)
    max_spaces_per_user: int = Field(default=10, ge=1, le=100)
    worker_poll_seconds: float = Field(default=2, ge=0.1, le=60)
    log_level: str = "INFO"

    @property
    def origins(self) -> list[str]:
        return [s.strip().rstrip("/") for s in self.allowed_origins.split(",") if s.strip()]

    @property
    def extraction_fallbacks(self) -> list[str]:
        return list(
            dict.fromkeys(s.strip() for s in self.openrouter_extraction_fallbacks.split(",") if s.strip())
        )

    @model_validator(mode="after")
    def production_configuration(self):
        if self.app_env == "production":
            if not self.cookie_secure or any(not s.startswith("https://") for s in self.origins):
                raise ValueError("Production requires secure cookies and explicit HTTPS origins")
            tls = parse_qs(urlsplit(self.database_url).query).get("sslmode", [""])[0]
            if not self.database_url or tls not in {"require", "verify-ca", "verify-full"}:
                raise ValueError("Production requires a TLS PostgreSQL connection string")
        if len(self.extraction_fallbacks) > 3:
            raise ValueError("At most three extraction fallbacks are allowed")
        for model in (self.openrouter_model, self.openrouter_extraction_model, *self.extraction_fallbacks):
            if model != "openrouter/free" and not model.endswith(":free"):
                raise ValueError("Only OpenRouter free model IDs are allowed")
        return self


@lru_cache
def settings() -> Settings:
    return Settings()
