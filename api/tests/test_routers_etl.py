"""Endpoints /etl/siafe. Integração com o Postgres de TEST_DATABASE_URL (ver conftest)."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, insert, select

from app.etl import siafe as etl
from app.auth.dependencias import usuario_atual
from app.main import app
from app.models import EtlExecucao
from app.routers.etl import get_engine, get_executor
from app.siafe.client import SiafeAuthError
from tests.conftest import USUARIO_TESTE
from tests.test_etl_siafe import FakeSiafe, _linha

SEGREDOS = ["senha-super-secreta", "token-secreto"]


@pytest.fixture
def api(db):
    from app.config import Settings

    settings = Settings(
        _env_file=None,
        siafe_url="https://siafe.example/api",
        siafe_user="usuario-teste",
        siafe_password=SEGREDOS[0],
        siafe_ug="000001",
        siafe_consulta="C",
        database_url="postgresql+psycopg2://u:p@localhost/db",
    )
    fake = FakeSiafe({(2023, 1): [_linha("000001", "1.00"), _linha("000002", "2.00")]})

    def executor(engine, reserva):
        return etl.executar(engine, reserva, settings=settings, cliente=fake, hoje=date(2023, 2, 1))

    app.dependency_overrides[get_engine] = lambda: db

    app.dependency_overrides[usuario_atual] = lambda: USUARIO_TESTE
    app.dependency_overrides[get_executor] = lambda: executor
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_status_sem_execucoes_retorna_404(api):
    assert api.get("/etl/siafe/status").status_code == 404


def test_disparo_retorna_202_e_status_mostra_sucesso(api):
    resp = api.post("/etl/siafe")
    assert resp.status_code == 202
    execucao_id = resp.json()["execucao_id"]

    # TestClient executa as BackgroundTasks antes de devolver a resposta.
    status = api.get("/etl/siafe/status")
    assert status.status_code == 200
    corpo = status.json()
    assert corpo["id"] == execucao_id
    assert corpo["status"] == "sucesso"
    assert corpo["origem"] == "http"
    assert corpo["registros"] == 2
    assert corpo["fim"] is not None
    assert not any(s in status.text for s in SEGREDOS)


def test_disparo_com_carga_em_andamento_retorna_409(api, db):
    reserva = etl.reservar(db, "cli")
    try:
        resp = api.post("/etl/siafe")
    finally:
        reserva.liberar()

    assert resp.status_code == 409
    assert resp.json()["execucao_id"] == reserva.execucao_id


def test_status_de_carga_com_falha_nao_vaza_segredos(db):
    fake = FakeSiafe({}, falha_em=(2023, 1))

    def executor(engine, reserva):
        return etl.executar(engine, reserva, cliente=fake, hoje=date(2023, 1, 1))

    app.dependency_overrides[get_engine] = lambda: db

    app.dependency_overrides[usuario_atual] = lambda: USUARIO_TESTE
    app.dependency_overrides[get_executor] = lambda: executor
    try:
        with TestClient(app) as client:
            assert client.post("/etl/siafe").status_code == 202
            resp = client.get("/etl/siafe/status")
    finally:
        app.dependency_overrides.clear()

    assert resp.json()["status"] == "falha"
    assert "503" in resp.json()["erro"]
    assert not any(s in resp.text for s in SEGREDOS)


# --- histórico ---


def _execucoes(db, *status: str) -> list[int]:
    """Insere execuções sintéticas na ordem dada (a última é a mais recente)."""
    with db.begin() as conn:
        return [
            conn.execute(
                insert(EtlExecucao).values(origem="cli", status=s, registros=None if s != "sucesso" else 10)
                .returning(EtlExecucao.id)
            ).scalar_one()
            for s in status
        ]


def test_historico_mais_recentes_primeiro(api, db):
    ids = _execucoes(db, "sucesso", "falha", "em_andamento")

    corpo = api.get("/etl/siafe/execucoes").json()
    assert (corpo["pagina"], corpo["tamanho"], corpo["total"]) == (1, 20, 3)
    assert [(i["id"], i["status"]) for i in corpo["itens"]] == [
        (ids[2], "em_andamento"), (ids[1], "falha"), (ids[0], "sucesso"),
    ]
    assert set(corpo["itens"][0]) == {"id", "origem", "status", "inicio", "fim", "registros", "erro"}


def test_historico_paginado(api, db):
    ids = _execucoes(db, *["sucesso"] * 25)

    corpo = api.get("/etl/siafe/execucoes", params={"pagina": 2}).json()
    assert corpo["total"] == 25
    assert [i["id"] for i in corpo["itens"]] == ids[4::-1]
    assert api.get("/etl/siafe/execucoes", params={"pagina": 9}).json()["itens"] == []


def test_historico_sem_execucoes(api):
    resp = api.get("/etl/siafe/execucoes")
    assert resp.status_code == 200
    assert (resp.json()["itens"], resp.json()["total"]) == ([], 0)


@pytest.mark.parametrize("params", [{"tamanho": 0}, {"tamanho": 101}, {"pagina": 0}])
def test_historico_limites_invalidos(api, params):
    assert api.get("/etl/siafe/execucoes", params=params).status_code == 422


def test_historico_nao_dispara_carga(db):
    chamadas = []
    app.dependency_overrides[get_engine] = lambda: db
    app.dependency_overrides[usuario_atual] = lambda: USUARIO_TESTE
    app.dependency_overrides[get_executor] = lambda: lambda engine, reserva: chamadas.append(reserva)
    try:
        with TestClient(app) as client:
            assert client.get("/etl/siafe/execucoes").status_code == 200
    finally:
        app.dependency_overrides.clear()
    assert chamadas == []
    assert _contar_execucoes(db) == 0


def _contar_execucoes(db) -> int:
    with db.connect() as conn:
        return conn.scalar(select(func.count()).select_from(EtlExecucao))


class _FakeAuthRecusada(FakeSiafe):
    def consultar(self, ano, mes):
        raise SiafeAuthError("Autenticação no SIAFE recusada: POST /auth respondeu 401")


def test_historico_com_falha_de_autenticacao_sem_segredos(api, db):
    fake = _FakeAuthRecusada({})

    from app.config import Settings

    settings = Settings(
        _env_file=None,
        siafe_url="https://siafe.example/api",
        siafe_user="usuario-teste",
        siafe_password=SEGREDOS[0],
        siafe_ug="000001",
        siafe_consulta="C",
        database_url="postgresql+psycopg2://u:p@localhost/db",
    )

    def executor(engine, reserva):
        return etl.executar(engine, reserva, settings=settings, cliente=fake, hoje=date(2023, 1, 1))

    app.dependency_overrides[get_executor] = lambda: executor
    assert api.post("/etl/siafe").status_code == 202

    resp = api.get("/etl/siafe/execucoes")
    [item] = resp.json()["itens"]
    assert item["status"] == "falha"
    assert item["fim"] is not None
    assert "401" in item["erro"]
    assert not any(s in resp.text for s in [*SEGREDOS, "usuario-teste"])


def test_disparo_sem_sessao_responde_401_e_nao_inicia_carga(db):
    chamadas = []
    app.dependency_overrides[get_engine] = lambda: db
    app.dependency_overrides[get_executor] = lambda: lambda engine, reserva: chamadas.append(reserva)
    try:
        with TestClient(app) as client:
            resp = client.post("/etl/siafe")
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 401
    assert chamadas == []
    with db.connect() as conn:
        assert conn.scalar(select(func.count()).select_from(EtlExecucao)) == 0
