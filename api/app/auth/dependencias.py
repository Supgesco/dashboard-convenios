"""Dependência FastAPI que exige sessão válida (aplicada aos routers /painel e /etl em main.py)."""

import logging
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError

from app.auth import servico
from app.routers.etl import get_engine

logger = logging.getLogger(__name__)

COOKIE_SESSAO = "convenios_sessao"


def usuario_atual(request: Request, engine: Annotated[Engine, Depends(get_engine)]) -> servico.UsuarioPublico:
    token = request.cookies.get(COOKIE_SESSAO)
    if token:
        try:
            usuario = servico.usuario_da_sessao(engine, token)
        except SQLAlchemyError:
            logger.exception("Falha ao verificar a sessão no banco")
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Banco de dados indisponível") from None
        if usuario is not None:
            return usuario
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão inválida ou expirada. Faça login novamente.")
