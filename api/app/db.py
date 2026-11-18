import threading
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> Engine:
    # hide_parameters evita que valores de bind apareçam em mensagens de erro/log.
    args: dict[str, object] = {}
    kwargs: dict[str, object] = {}
    is_sqlite = "sqlite" in url
    if "postgresql" in url:
        args["connect_timeout"] = 1
    elif is_sqlite:
        args["check_same_thread"] = False
        args["timeout"] = 30
        if url == "sqlite:///:memory:":
            kwargs["poolclass"] = StaticPool

    eng = create_engine(url, hide_parameters=True, pool_pre_ping=True, connect_args=args, **kwargs)

    if is_sqlite:
        @event.listens_for(eng, "connect")
        def _set_sqlite_pragmas(dbapi_connection, connection_record):
            try:
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA busy_timeout = 10000")
                cursor.execute("PRAGMA foreign_keys = ON")
                if ":memory:" not in url:
                    cursor.execute("PRAGMA journal_mode = WAL")
                    cursor.execute("PRAGMA synchronous = NORMAL")
                cursor.close()
            except Exception:
                pass

    return eng


engine = make_engine(get_settings().database_url.get_secret_value())
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
