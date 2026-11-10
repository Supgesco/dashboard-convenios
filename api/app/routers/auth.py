"""Login do painel: POST /auth/login, GET /auth/me, POST /auth/logout.

A sessão é um token opaco no cookie HttpOnly `convenios_sessao`; o banco guarda só o hash.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError

from app.auth import servico
from app.auth.dependencias import COOKIE_SESSAO, usuario_atual
from app.config import Settings, get_settings
from app.routers.etl import get_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

MENSAGEM_INVALIDO = "E-mail ou senha inválidos."
MENSAGEM_BLOQUEADO = "Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em alguns minutos."


class Credenciais(BaseModel):
    email: str
    senha: str


class UsuarioPublico(BaseModel):
    id: int
    email: str
    nome: str
    cargo: str | None
    orgao: str | None
    perfil: str


def _indisponivel() -> HTTPException:
    logger.exception("Falha de banco na autenticação")
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Banco de dados indisponível")


@router.post(
    "/login",
    response_model=UsuarioPublico,
    responses={401: {"description": MENSAGEM_INVALIDO}, 429: {"description": "Conta bloqueada"}},
)
def login(
    credenciais: Credenciais,
    response: Response,
    engine: Annotated[Engine, Depends(get_engine)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    try:
        usuario = servico.autenticar(engine, credenciais.email, credenciais.senha)
        if usuario is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, MENSAGEM_INVALIDO)
        token = servico.abrir_sessao(engine, usuario.id, settings.sessao_horas)
    except servico.ContaBloqueada:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, MENSAGEM_BLOQUEADO) from None
    except SQLAlchemyError:
        raise _indisponivel() from None
    response.set_cookie(
        COOKIE_SESSAO,
        token,
        max_age=int(settings.sessao_horas * 3600),
        path="/",
        httponly=True,
        secure=settings.sessao_cookie_seguro,
        samesite="lax",
    )
    return UsuarioPublico.model_validate(usuario, from_attributes=True)


@router.get("/me", response_model=UsuarioPublico, responses={401: {"description": "Sem sessão válida"}})
def me(usuario: Annotated[servico.UsuarioPublico, Depends(usuario_atual)]):
    return UsuarioPublico.model_validate(usuario, from_attributes=True)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    engine: Annotated[Engine, Depends(get_engine)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    token = request.cookies.get(COOKIE_SESSAO)
    if token:
        try:
            servico.encerrar_sessao(engine, token)
        except SQLAlchemyError:
            raise _indisponivel() from None
    response.delete_cookie(
        COOKIE_SESSAO, path="/", httponly=True, secure=settings.sessao_cookie_seguro, samesite="lax"
    )
