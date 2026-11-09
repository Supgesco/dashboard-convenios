from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    siafe_url: str = "https://siafe.fazenda.rj.gov.br"
    siafe_user: str = "usuario"
    siafe_password: SecretStr = SecretStr("senha")
    siafe_ug: str = "530100"
    siafe_consulta: str = "1"

    database_url: SecretStr = SecretStr("sqlite:///:memory:")

    siafe_timeout_seconds: float = 60.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
