"""Fixtures compartilhadas.

Testes de integração usam um Postgres **separado**, apontado por TEST_DATABASE_URL.
Sem essa variável eles são pulados; nunca usam o DATABASE_URL do .env.
Fixtures de dados são sempre sintéticos: dados reais de convênio não podem ser versionados.
"""

import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, text

from app.config import API_DIR
from app.db import make_engine
from app.planilha.layout import ABAS

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

# Tabelas que os testes apagam. Se alguma já tiver dados, o banco não é de teste.
TABELAS_COM_DADOS = ["siafe_flexvision", "planilha_importacao", *(aba.tabela for aba in ABAS)]
TRUNCATE = (
    f"TRUNCATE siafe_flexvision, etl_execucao, {', '.join(TABELAS_COM_DADOS[1:])} RESTART IDENTITY CASCADE"
)


def _tabela_com_dados(conn) -> str | None:
    for tabela in TABELAS_COM_DADOS:
        existe = conn.scalar(text("SELECT to_regclass(:t) IS NOT NULL"), {"t": tabela})
        if existe and conn.scalar(text(f"SELECT EXISTS (SELECT 1 FROM {tabela})")):
            return tabela
    return None


def _alembic_config() -> Config:
    return Config(str(API_DIR / "alembic.ini"))


@pytest.fixture(scope="session")
def db_engine() -> Engine:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL não definida: testes de integração pulados")

    engine = make_engine(TEST_DATABASE_URL)
    with engine.connect() as conn:
        ja_migrado = conn.scalar(text("SELECT to_regclass('alembic_version') IS NOT NULL"))
        com_dados = _tabela_com_dados(conn) if ja_migrado else None
    if com_dados:
        engine.dispose()
        pytest.exit(
            f"TEST_DATABASE_URL aponta para um banco com dados em {com_dados}; "
            "os testes apagam as tabelas. Use um banco vazio.",
            returncode=1,
        )

    anterior = os.environ.get("ALEMBIC_DATABASE_URL")
    os.environ["ALEMBIC_DATABASE_URL"] = TEST_DATABASE_URL
    cfg = _alembic_config()
    command.upgrade(cfg, "head")

    yield engine

    with engine.begin() as conn:
        conn.execute(text(TRUNCATE))
    engine.dispose()
    # Só desfaz as tabelas se foram os testes que as criaram.
    if not ja_migrado:
        command.downgrade(cfg, "base")
    if anterior is None:
        os.environ.pop("ALEMBIC_DATABASE_URL", None)
    else:
        os.environ["ALEMBIC_DATABASE_URL"] = anterior


@pytest.fixture
def db(db_engine: Engine) -> Engine:
    """Engine de teste com as tabelas limpas antes de cada teste."""
    with db_engine.begin() as conn:
        conn.execute(text(TRUNCATE))
    return db_engine
