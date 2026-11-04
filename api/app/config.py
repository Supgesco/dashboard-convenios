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

    siafe_url: str
    siafe_user: str
    siafe_password: SecretStr
    siafe_ug: str
    siafe_consulta: str

    database_url: SecretStr

    siafe_timeout_seconds: float = 60.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
