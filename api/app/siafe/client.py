"""Cliente HTTP da API do SIAFE (autenticação + consulta FlexVision).

Regras de sigilo: mensagens de erro e logs contêm apenas método, rota e status HTTP.
Nunca incluem usuário, senha, token nem o corpo das requisições/respostas de /auth.
"""

import logging
import time
from collections.abc import Callable
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

MAX_TENTATIVAS = 3
STATUS_TRANSITORIOS = {429, 500, 502, 503, 504}


class SiafeError(Exception):
    """Falha definitiva ao falar com o SIAFE."""


class SiafeAuthError(SiafeError):
    """O SIAFE recusou a autenticação."""


class _Transitorio(Exception):
    def __init__(self, descricao: str):
        super().__init__(descricao)
        self.descricao = descricao


class SiafeClient:
    def __init__(
        self,
        settings: Settings,
        http: httpx.Client | None = None,
        espera: Callable[[float], None] = time.sleep,
    ):
        self._settings = settings
        self._base = settings.siafe_url.rstrip("/")
        self._http = http or httpx.Client(timeout=settings.siafe_timeout_seconds)
        self._espera = espera
        self._token: str | None = None

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "SiafeClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # --- autenticação -----------------------------------------------------

    def autenticar(self) -> None:
        corpo = {
            "usuario": self._settings.siafe_user,
            "senha": self._settings.siafe_password.get_secret_value(),
        }

        def tentativa() -> httpx.Response:
            resp = self._http.post(f"{self._base}/auth", json=corpo)
            if resp.status_code in STATUS_TRANSITORIOS:
                raise _Transitorio(f"POST /auth respondeu {resp.status_code}")
            if resp.status_code >= 400:
                raise SiafeAuthError(f"Autenticação no SIAFE recusada: POST /auth respondeu {resp.status_code}")
            if not resp.content:
                # Observado na API real: 200 com corpo vazio de forma intermitente.
                raise _Transitorio("POST /auth respondeu 200 sem corpo")
            return resp

        resp = self._com_retry(tentativa)
        try:
            token = resp.json()["token"]
        except (ValueError, KeyError, TypeError):
            raise SiafeAuthError("Resposta de POST /auth sem o campo 'token'") from None
        if not token:
            raise SiafeAuthError("Resposta de POST /auth com 'token' vazio")
        self._token = token

    # --- consulta ---------------------------------------------------------

    def rota_consulta(self, ano: int, mes: int) -> tuple[str, dict[str, Any] | None]:
        """Rota e query string da consulta FlexVision para (ano, mês).

        Único ponto que conhece o formato dos parâmetros da consulta.
        """
        # Formato confirmado: ?params=<ug>,<mes>,<ano> (nessa ordem).
        s = self._settings
        return f"/flexvision-consulta/{s.siafe_consulta}", {"params": f"{s.siafe_ug},{mes},{ano}"}

    def consultar(self, ano: int, mes: int) -> Any:
        if self._token is None:
            self.autenticar()

        rota, params = self.rota_consulta(ano, mes)
        rotulo = f"GET /flexvision-consulta ({ano}-{mes:02d})"
        reautenticou = False

        while True:
            def tentativa() -> httpx.Response:
                resp = self._http.get(
                    self._base + rota,
                    params=params,
                    headers={"Authorization": f"Bearer {self._token}"},
                )
                if resp.status_code in STATUS_TRANSITORIOS:
                    raise _Transitorio(f"{rotulo} respondeu {resp.status_code}")
                return resp

            resp = self._com_retry(tentativa)

            if resp.status_code == 401:
                if reautenticou:
                    raise SiafeAuthError(f"{rotulo} respondeu 401 mesmo após reautenticação")
                logger.info("%s respondeu 401; reautenticando", rotulo)
                self.autenticar()
                reautenticou = True
                continue

            if resp.status_code >= 400:
                raise SiafeError(f"{rotulo} respondeu {resp.status_code}")

            try:
                return resp.json()
            except ValueError:
                raise SiafeError(f"{rotulo} retornou conteúdo que não é JSON") from None

    # --- infraestrutura ---------------------------------------------------

    def _com_retry(self, tentativa: Callable[[], httpx.Response]) -> httpx.Response:
        ultimo = ""
        for n in range(1, MAX_TENTATIVAS + 1):
            try:
                return tentativa()
            except _Transitorio as e:
                ultimo = e.descricao
            except httpx.TimeoutException as e:
                ultimo = f"timeout ({type(e).__name__})"
            except httpx.TransportError as e:
                ultimo = f"erro de conexão ({type(e).__name__})"
            if n < MAX_TENTATIVAS:
                atraso = 2 ** (n - 1)  # 1s, 2s
                logger.warning("SIAFE: %s; tentativa %d/%d, nova tentativa em %ss", ultimo, n, MAX_TENTATIVAS, atraso)
                self._espera(atraso)
        raise SiafeError(f"SIAFE indisponível após {MAX_TENTATIVAS} tentativas: {ultimo}")
