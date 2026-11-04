from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> Engine:
    # hide_parameters evita que valores de bind apareçam em mensagens de erro/log.
    return create_engine(url, hide_parameters=True, pool_pre_ping=True)


engine = make_engine(get_settings().database_url.get_secret_value())
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
