import logging

import httpx
import pytest
import respx

from app.config import Settings
from app.siafe.client import SiafeAuthError, SiafeClient, SiafeError

BASE = "https://siafe.example/api"
USUARIO = "usuario-teste"
SENHA = "senha-super-secreta"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        siafe_url=BASE,
        siafe_user=USUARIO,
        siafe_password=SENHA,
        siafe_ug="000000",
        siafe_consulta="CONSULTA",
        database_url="postgresql+psycopg2://u:p@localhost/db",
    )


@pytest.fixture
def client(settings: Settings):
    esperas: list[float] = []
    c = SiafeClient(settings, http=httpx.Client(), espera=esperas.append)
    c.esperas = esperas
    yield c
    c.close()


def _auth_ok(token: str = "tok-1") -> httpx.Response:
    return httpx.Response(200, json={"token": token, "tipo": "Bearer"})


@respx.mock
def test_token_e_enviado_no_header(client):
    auth = respx.post(f"{BASE}/auth").mock(return_value=_auth_ok("tok-1"))
    consulta = respx.get(f"{BASE}/flexvision-consulta/CONSULTA").mock(return_value=httpx.Response(200, json=[]))

    assert client.consultar(2025, 1) == []

    import json

    assert json.loads(auth.calls.last.request.content) == {"usuario": USUARIO, "senha": SENHA}
    assert consulta.calls.last.request.headers["Authorization"] == "Bearer tok-1"
    assert consulta.calls.last.request.url.params["params"] == "000000,1,2025"


@respx.mock
def test_token_reutilizado_entre_consultas(client):
    auth = respx.post(f"{BASE}/auth").mock(return_value=_auth_ok())
    respx.get(f"{BASE}/flexvision-consulta/CONSULTA").mock(return_value=httpx.Response(200, json=[]))

    client.consultar(2025, 1)
    client.consultar(2025, 2)

    assert auth.call_count == 1


@respx.mock
def test_503_depois_200(client):
    respx.post(f"{BASE}/auth").mock(return_value=_auth_ok())
    respx.get(f"{BASE}/flexvision-consulta/CONSULTA").mock(
        side_effect=[httpx.Response(503), httpx.Response(200, json=[{"a": 1}])]
    )

    assert client.consultar(2025, 1) == [{"a": 1}]
    assert client.esperas == [1]


@respx.mock
def test_tres_falhas_transitorias_viram_erro(client):
    respx.post(f"{BASE}/auth").mock(return_value=_auth_ok())
    rota = respx.get(f"{BASE}/flexvision-consulta/CONSULTA").mock(
        side_effect=[httpx.Response(503), httpx.ConnectTimeout("t"), httpx.Response(429)]
    )

    with pytest.raises(SiafeError, match="3 tentativas"):
        client.consultar(2025, 1)
    assert rota.call_count == 3
    assert client.esperas == [1, 2]


@respx.mock
def test_auth_com_corpo_vazio_e_transitorio(client):
    auth = respx.post(f"{BASE}/auth").mock(side_effect=[httpx.Response(200, content=b""), _auth_ok()])
    respx.get(f"{BASE}/flexvision-consulta/CONSULTA").mock(return_value=httpx.Response(200, json=[]))

    client.consultar(2025, 1)
    assert auth.call_count == 2


@respx.mock
def test_401_reautentica_e_repete(client):
    auth = respx.post(f"{BASE}/auth").mock(side_effect=[_auth_ok("velho"), _auth_ok("novo")])
    rota = respx.get(f"{BASE}/flexvision-consulta/CONSULTA").mock(
        side_effect=[httpx.Response(401), httpx.Response(200, json=[])]
    )

    assert client.consultar(2025, 1) == []
    assert auth.call_count == 2
    assert rota.calls.last.request.headers["Authorization"] == "Bearer novo"


@respx.mock
def test_401_persistente_falha(client):
    respx.post(f"{BASE}/auth").mock(side_effect=[_auth_ok("a"), _auth_ok("b")])
    respx.get(f"{BASE}/flexvision-consulta/CONSULTA").mock(return_value=httpx.Response(401))

    with pytest.raises(SiafeAuthError, match="401"):
        client.consultar(2025, 1)


@respx.mock
def test_falha_de_auth_nao_vaza_credenciais(client, caplog):
    caplog.set_level(logging.DEBUG)
    respx.post(f"{BASE}/auth").mock(
        return_value=httpx.Response(401, json={"erro": f"usuario {USUARIO} senha {SENHA} invalidos"})
    )

    with pytest.raises(SiafeAuthError) as exc:
        client.consultar(2025, 1)

    texto = str(exc.value) + caplog.text
    assert "401" in str(exc.value)
    assert USUARIO not in texto
    assert SENHA not in texto


@respx.mock
def test_erro_na_consulta_nao_vaza_token(client, caplog):
    caplog.set_level(logging.DEBUG)
    respx.post(f"{BASE}/auth").mock(return_value=_auth_ok("token-secreto"))
    respx.get(f"{BASE}/flexvision-consulta/CONSULTA").mock(return_value=httpx.Response(503))

    with pytest.raises(SiafeError) as exc:
        client.consultar(2025, 1)

    assert "token-secreto" not in str(exc.value) + caplog.text
