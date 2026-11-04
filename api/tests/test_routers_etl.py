"""Endpoints /etl/siafe. Integração com o Postgres de TEST_DATABASE_URL (ver conftest)."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.etl import siafe as etl
from app.main import app
from app.routers.etl import get_engine, get_executor
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
