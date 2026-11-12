"""Contas e sessões de login no banco.

As funções recebem o engine e um `agora` opcional (para os testes controlarem o relógio).
O token da sessão só existe no cookie: o banco guarda o SHA-256 dele.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import Engine, delete, func, insert, select, update
from sqlalchemy.exc import IntegrityError

from app.auth import senha as senhas
from app.models import Sessao, Usuario

PERFIS = ("administrador", "analista", "auditor")
MAXIMO_FALHAS = 5
TEMPO_BLOQUEIO = timedelta(minutes=15)

# Colunas que podem sair da API (nunca o hash nem o controle de tentativas).
COLUNAS_PUBLICAS = (Usuario.id, Usuario.email, Usuario.nome, Usuario.cargo, Usuario.orgao, Usuario.perfil)


@dataclass(frozen=True)
class UsuarioPublico:
    id: int
    email: str
    nome: str
    cargo: str | None
    orgao: str | None
    perfil: str


class ErroUsuario(Exception):
    """Erro de validação ao administrar usuários (mensagem pronta para o operador)."""


class ContaBloqueada(Exception):
    def __init__(self, ate: datetime):
        super().__init__(f"Conta bloqueada até {ate.isoformat()}")
        self.ate = ate


def _agora(agora: datetime | None) -> datetime:
    return agora or datetime.now(UTC)


def normalizar_email(email: str) -> str:
    return email.strip().lower()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def _publico(linha) -> UsuarioPublico:
    return UsuarioPublico(**{c.key: getattr(linha, c.key) for c in COLUNAS_PUBLICAS})


def _garantir_sqlite_local(engine: Engine) -> None:
    """No modo local sem PostgreSQL (SQLite em memória), cria as tabelas de auth e o usuário padrão."""
    if engine.dialect.name != "sqlite":
        return
    Usuario.__table__.create(engine, checkfirst=True)
    Sessao.__table__.create(engine, checkfirst=True)
    with engine.begin() as conn:
        existe = conn.scalar(select(func.count()).select_from(Usuario))
        if not existe:
            conn.execute(
                insert(Usuario).values(
                    email="admin@obras.rj.gov.br",
                    nome="Coordenação de Convênios",
                    cargo="Gestão",
                    orgao="SEIOP",
                    perfil="administrador",
                    senha_hash=senhas.gerar_hash("Seiop@1234"),
                )
            )


def _com_tz(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt


# --- Login -------------------------------------------------------------------------------


def autenticar(engine: Engine, email: str, senha: str, agora: datetime | None = None) -> UsuarioPublico | None:
    """Usuário se e-mail e senha conferem e a conta está ativa; None caso contrário.

    Conta em bloqueio levanta ContaBloqueada sem verificar a senha. Cada senha errada conta
    uma falha; na MAXIMO_FALHAS-ésima a conta fica bloqueada por TEMPO_BLOQUEIO.
    """
    _garantir_sqlite_local(engine)
    agora = _agora(agora)
    with engine.begin() as conn:
        u = conn.execute(
            select(Usuario.__table__).where(func.lower(Usuario.email) == normalizar_email(email)).with_for_update()
        ).first()
        if u is None:
            senhas.verificar_ficticio(senha)
            return None
        bloqueado_ate = _com_tz(u.bloqueado_ate)
        if bloqueado_ate is not None and bloqueado_ate > agora:
            raise ContaBloqueada(bloqueado_ate)

        confere = senhas.verificar(senha, u.senha_hash)
        if not confere:
            falhas = u.falhas_consecutivas + 1
            valores = (
                {"falhas_consecutivas": 0, "bloqueado_ate": agora + TEMPO_BLOQUEIO}
                if falhas >= MAXIMO_FALHAS
                else {"falhas_consecutivas": falhas}
            )
            conn.execute(update(Usuario).where(Usuario.id == u.id).values(**valores))
            return None
        if u.falhas_consecutivas or u.bloqueado_ate is not None:
            conn.execute(
                update(Usuario).where(Usuario.id == u.id).values(falhas_consecutivas=0, bloqueado_ate=None)
            )
        return _publico(u) if u.ativo else None


def abrir_sessao(engine: Engine, usuario_id: int, horas: float, agora: datetime | None = None) -> str:
    """Cria a sessão e devolve o token (só ele vai para o cookie). Apaga as sessões vencidas."""
    _garantir_sqlite_local(engine)
    agora = _agora(agora)
    token = secrets.token_urlsafe(32)
    with engine.begin() as conn:
        conn.execute(delete(Sessao).where(Sessao.expira_em <= agora))
        conn.execute(
            insert(Sessao).values(
                token_hash=hash_token(token), usuario_id=usuario_id, expira_em=agora + timedelta(hours=horas)
            )
        )
    return token


def usuario_da_sessao(engine: Engine, token: str, agora: datetime | None = None) -> UsuarioPublico | None:
    """Usuário ativo dono de uma sessão não vencida, ou None."""
    _garantir_sqlite_local(engine)
    agora = _agora(agora)
    with engine.connect() as conn:
        u = conn.execute(
            select(*COLUNAS_PUBLICAS)
            .join(Sessao, Sessao.usuario_id == Usuario.id)
            .where(Sessao.token_hash == hash_token(token), Sessao.expira_em > agora, Usuario.ativo)
        ).first()
    return _publico(u) if u else None


def encerrar_sessao(engine: Engine, token: str) -> None:
    _garantir_sqlite_local(engine)
    with engine.begin() as conn:
        conn.execute(delete(Sessao).where(Sessao.token_hash == hash_token(token)))


# --- Administração ------------------------------------------------------------------------


def _validar_senha(senha: str) -> None:
    erro = senhas.validar_nova_senha(senha)
    if erro:
        raise ErroUsuario(erro)


def criar_usuario(
    engine: Engine,
    email: str,
    nome: str,
    perfil: str,
    senha: str,
    cargo: str | None = None,
    orgao: str | None = None,
) -> int:
    email = normalizar_email(email)
    if "@" not in email:
        raise ErroUsuario(f"E-mail inválido: {email!r}")
    if not nome.strip():
        raise ErroUsuario("Informe o nome.")
    if perfil not in PERFIS:
        raise ErroUsuario(f"Perfil inválido: {perfil!r} (use {', '.join(PERFIS)})")
    _validar_senha(senha)
    try:
        with engine.begin() as conn:
            return conn.scalar(
                insert(Usuario)
                .values(
                    email=email,
                    nome=nome.strip(),
                    perfil=perfil,
                    cargo=(cargo or "").strip() or None,
                    orgao=(orgao or "").strip() or None,
                    senha_hash=senhas.gerar_hash(senha),
                )
                .returning(Usuario.id)
            )
    except IntegrityError:
        raise ErroUsuario(f"Já existe usuário com o e-mail {email}") from None


def _id_por_email(conn, email: str) -> int:
    uid = conn.scalar(select(Usuario.id).where(func.lower(Usuario.email) == normalizar_email(email)))
    if uid is None:
        raise ErroUsuario(f"Usuário não encontrado: {normalizar_email(email)}")
    return uid


def trocar_senha(engine: Engine, email: str, senha: str) -> None:
    """Grava a nova senha, desfaz o bloqueio e encerra as sessões do usuário."""
    _validar_senha(senha)
    with engine.begin() as conn:
        uid = _id_por_email(conn, email)
        conn.execute(
            update(Usuario)
            .where(Usuario.id == uid)
            .values(senha_hash=senhas.gerar_hash(senha), falhas_consecutivas=0, bloqueado_ate=None)
        )
        conn.execute(delete(Sessao).where(Sessao.usuario_id == uid))


def definir_ativo(engine: Engine, email: str, ativo: bool) -> None:
    """Ativa ou desativa; desativar encerra as sessões abertas."""
    with engine.begin() as conn:
        uid = _id_por_email(conn, email)
        conn.execute(update(Usuario).where(Usuario.id == uid).values(ativo=ativo))
        if not ativo:
            conn.execute(delete(Sessao).where(Sessao.usuario_id == uid))


def listar(engine: Engine) -> list[dict]:
    """Usuários com dados públicos e situação, sem hash."""
    with engine.connect() as conn:
        linhas = conn.execute(
            select(*COLUNAS_PUBLICAS, Usuario.ativo, Usuario.bloqueado_ate, Usuario.criado_em).order_by(Usuario.email)
        ).all()
    return [dict(l._mapping) for l in linhas]
