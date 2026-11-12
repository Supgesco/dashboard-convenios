from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> Engine:
    # hide_parameters evita que valores de bind apareçam em mensagens de erro/log.
    args: dict[str, object] = {}
    kwargs: dict[str, object] = {}
    if "postgresql" in url:
        args["connect_timeout"] = 1
    elif url == "sqlite:///:memory:":
        args["check_same_thread"] = False
        kwargs["poolclass"] = StaticPool
    return create_engine(url, hide_parameters=True, pool_pre_ping=True, connect_args=args, **kwargs)


engine = make_engine(get_settings().database_url.get_secret_value())
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
