"""Endpoints /auth e proteção das rotas. Integração com o Postgres de TEST_DATABASE_URL (ver conftest)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import servico
from app.auth.dependencias import COOKIE_SESSAO
from app.config import Settings, get_settings
from app.main import app
from app.models import Sessao
from app.routers.etl import get_engine

EMAIL = "fulano@obras.rj.gov.br"
SENHA = "Exemplo@123"
INVALIDO = {"detail": "E-mail ou senha inválidos."}


@pytest.fixture
def api(db):
    settings = Settings(_env_file=None, sessao_cookie_seguro=False, sessao_horas=12)
    app.dependency_overrides[get_engine] = lambda: db
    app.dependency_overrides[get_settings] = lambda: settings
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def usuario(db):
    return servico.criar_usuario(db, EMAIL, "Fulano", "analista", SENHA, cargo="Gestão", orgao="SEIOP")


def _login(api, email=EMAIL, senha=SENHA):
    return api.post("/auth/login", json={"email": email, "senha": senha})


def test_login_correto_define_cookie_e_devolve_dados_publicos(api, usuario):
    resp = _login(api, email="  Fulano@Obras.rj.gov.br ")

    assert resp.status_code == 200
    assert resp.json() == {
        "id": usuario,
        "email": EMAIL,
        "nome": "Fulano",
        "cargo": "Gestão",
        "orgao": "SEIOP",
        "perfil": "analista",
    }
    cookie = resp.headers["set-cookie"]
    assert cookie.startswith(f"{COOKIE_SESSAO}=")
    assert "HttpOnly" in cookie
    assert "samesite=lax" in cookie.lower()
    assert "Path=/" in cookie
    assert "scrypt" not in resp.text


def test_cookie_secure_por_padrao(db, usuario):
    app.dependency_overrides[get_engine] = lambda: db
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None)
    try:
        with TestClient(app) as client:
            resp = _login(client)
    finally:
        app.dependency_overrides.clear()

    assert "Secure" in resp.headers["set-cookie"]


def test_credenciais_invalidas_tem_a_mesma_resposta(api, db, usuario):
    servico.criar_usuario(db, "inativo@obras.rj.gov.br", "Inativo", "analista", SENHA)
    servico.definir_ativo(db, "inativo@obras.rj.gov.br", False)

    respostas = [
        _login(api, senha="errada!!"),
        _login(api, email="ninguem@obras.rj.gov.br"),
        _login(api, email="inativo@obras.rj.gov.br"),
    ]

    for resp in respostas:
        assert resp.status_code == 401
        assert resp.json() == INVALIDO
        assert "set-cookie" not in resp.headers
    with db.connect() as conn:
        assert conn.scalars(select(Sessao.token_hash)).all() == []


def test_conta_bloqueada_responde_429_mesmo_com_a_senha_certa(api, usuario):
    for _ in range(5):
        assert _login(api, senha="errada!!").status_code == 401

    resp = _login(api)

    assert resp.status_code == 429
    assert "bloqueada" in resp.json()["detail"]
    assert "set-cookie" not in resp.headers


def test_corpo_invalido_responde_422(api):
    assert api.post("/auth/login", json={"email": EMAIL}).status_code == 422


def test_me_com_e_sem_sessao(api, usuario):
    assert api.get("/auth/me").status_code == 401

    _login(api)
    resp = api.get("/auth/me")

    assert resp.status_code == 200
    assert resp.json()["email"] == EMAIL


def test_cookie_inventado_nao_vale(api, usuario):
    api.cookies.set(COOKIE_SESSAO, "token-inventado")

    assert api.get("/auth/me").status_code == 401


def test_logout_encerra_a_sessao_no_servidor(api, usuario):
    _login(api)
    token = api.cookies.get(COOKIE_SESSAO)

    resp = api.post("/auth/logout")

    assert resp.status_code == 204
    assert f'{COOKIE_SESSAO}=""' in resp.headers["set-cookie"] or "Max-Age=0" in resp.headers["set-cookie"]
    api.cookies.set(COOKIE_SESSAO, token)  # reapresenta o cookie antigo
    assert api.get("/auth/me").status_code == 401


def test_logout_sem_sessao_tem_sucesso(api):
    assert api.post("/auth/logout").status_code == 204


def test_rotas_protegidas_sem_e_com_sessao(api, usuario):
    for metodo, caminho in [("get", "/painel/resumo"), ("get", "/painel/convenios"), ("get", "/etl/siafe/status")]:
        assert getattr(api, metodo)(caminho).status_code == 401, caminho

    _login(api)

    assert api.get("/painel/resumo").status_code == 200
    assert api.get("/etl/siafe/status").status_code == 404  # nenhuma carga ainda: passou da autenticação


def test_desativar_derruba_a_sessao_aberta(api, db, usuario):
    _login(api)
    assert api.get("/auth/me").status_code == 200

    servico.definir_ativo(db, EMAIL, False)

    assert api.get("/auth/me").status_code == 401
    assert api.get("/painel/resumo").status_code == 401
