"""Contas e sessões no banco. Integração com o Postgres de TEST_DATABASE_URL (ver conftest)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text

from app.auth import servico
from app.models import Sessao, Usuario

SENHA = "Exemplo@123"
T0 = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)


def _criar(db, email="fulano@obras.rj.gov.br", **kw):
    return servico.criar_usuario(db, email, kw.pop("nome", "Fulano"), kw.pop("perfil", "analista"), SENHA, **kw)


def test_senha_nunca_fica_em_claro_no_banco(db):
    _criar(db, "a@obras.rj.gov.br")
    _criar(db, "b@obras.rj.gov.br")

    with db.connect() as conn:
        despejo = conn.scalar(text("SELECT string_agg(u::text, '|') FROM usuario u"))
        hashes = conn.scalars(select(Usuario.senha_hash)).all()
    assert SENHA not in despejo
    assert hashes[0] != hashes[1]


def test_email_normalizado_e_unico_sem_diferenciar_caixa(db):
    _criar(db, "  Fulano@Obras.RJ.gov.br ")
    with pytest.raises(servico.ErroUsuario, match="Já existe"):
        _criar(db, "FULANO@obras.rj.gov.br")

    assert servico.autenticar(db, "fulano@OBRAS.rj.gov.br  ", SENHA, T0) is not None


@pytest.mark.parametrize(
    "kw,motivo",
    [({"perfil": "chefe"}, "Perfil"), ({"nome": "  "}, "nome")],
)
def test_criacao_invalida(db, kw, motivo):
    with pytest.raises(servico.ErroUsuario, match=motivo):
        _criar(db, **kw)


def test_senha_curta_recusada_sem_gravar(db):
    with pytest.raises(servico.ErroUsuario, match="8 caracteres"):
        servico.criar_usuario(db, "x@obras.rj.gov.br", "X", "analista", "1234567")
    assert servico.listar(db) == []


def test_autenticar_devolve_so_dados_publicos(db):
    uid = _criar(db, cargo="Gestão", orgao="SEIOP")

    u = servico.autenticar(db, "fulano@obras.rj.gov.br", SENHA, T0)

    assert u == servico.UsuarioPublico(uid, "fulano@obras.rj.gov.br", "Fulano", "Gestão", "SEIOP", "analista")


def test_senha_errada_email_inexistente_e_inativo_dao_none(db):
    _criar(db)
    _criar(db, "inativo@obras.rj.gov.br")
    servico.definir_ativo(db, "inativo@obras.rj.gov.br", False)

    assert servico.autenticar(db, "fulano@obras.rj.gov.br", "errada!!", T0) is None
    assert servico.autenticar(db, "ninguem@obras.rj.gov.br", SENHA, T0) is None
    assert servico.autenticar(db, "inativo@obras.rj.gov.br", SENHA, T0) is None


def test_bloqueio_apos_cinco_erros_e_expiracao(db):
    _criar(db)
    email = "fulano@obras.rj.gov.br"
    for _ in range(4):
        assert servico.autenticar(db, email, "errada!!", T0) is None
    assert servico.autenticar(db, email, "errada!!", T0) is None  # 5º erro: bloqueia

    with pytest.raises(servico.ContaBloqueada):
        servico.autenticar(db, email, SENHA, T0 + timedelta(minutes=14))

    assert servico.autenticar(db, email, SENHA, T0 + timedelta(minutes=15, seconds=1)) is not None
    with db.connect() as conn:
        falhas, bloqueio = conn.execute(select(Usuario.falhas_consecutivas, Usuario.bloqueado_ate)).one()
    assert (falhas, bloqueio) == (0, None)


def test_login_correto_zera_a_contagem(db):
    _criar(db)
    email = "fulano@obras.rj.gov.br"
    for _ in range(4):
        servico.autenticar(db, email, "errada!!", T0)
    assert servico.autenticar(db, email, SENHA, T0) is not None
    for _ in range(4):
        servico.autenticar(db, email, "errada!!", T0)

    assert servico.autenticar(db, email, SENHA, T0) is not None  # não bloqueou: a contagem tinha zerado


def test_sessao_token_nao_fica_no_banco_e_expira(db):
    uid = _criar(db)
    token = servico.abrir_sessao(db, uid, horas=12, agora=T0)

    with db.connect() as conn:
        despejo = conn.scalar(text("SELECT string_agg(s::text, '|') FROM sessao s"))
    assert token not in despejo
    assert servico.usuario_da_sessao(db, token, T0 + timedelta(hours=11)).id == uid
    assert servico.usuario_da_sessao(db, token, T0 + timedelta(hours=12)) is None
    assert servico.usuario_da_sessao(db, "token-inventado", T0) is None


def test_abrir_sessao_apaga_as_vencidas(db):
    uid = _criar(db)
    servico.abrir_sessao(db, uid, horas=1, agora=T0)
    servico.abrir_sessao(db, uid, horas=1, agora=T0 + timedelta(hours=2))

    with db.connect() as conn:
        assert conn.scalar(select(text("count(*)")).select_from(Sessao)) == 1


def test_encerrar_sessao(db):
    uid = _criar(db)
    token = servico.abrir_sessao(db, uid, horas=12, agora=T0)
    servico.encerrar_sessao(db, token)

    assert servico.usuario_da_sessao(db, token, T0) is None


def test_desativar_derruba_sessoes_e_ativar_volta(db):
    uid = _criar(db)
    token = servico.abrir_sessao(db, uid, horas=12, agora=T0)

    servico.definir_ativo(db, "fulano@obras.rj.gov.br", False)
    assert servico.usuario_da_sessao(db, token, T0) is None
    assert servico.autenticar(db, "fulano@obras.rj.gov.br", SENHA, T0) is None

    servico.definir_ativo(db, "fulano@obras.rj.gov.br", True)
    assert servico.autenticar(db, "fulano@obras.rj.gov.br", SENHA, T0) is not None


def test_trocar_senha_desbloqueia_e_derruba_sessoes(db):
    uid = _criar(db)
    email = "fulano@obras.rj.gov.br"
    token = servico.abrir_sessao(db, uid, horas=12, agora=T0)
    for _ in range(5):
        servico.autenticar(db, email, "errada!!", T0)

    servico.trocar_senha(db, email, "NovaSenha#1")

    assert servico.usuario_da_sessao(db, token, T0) is None
    assert servico.autenticar(db, email, SENHA, T0) is None
    assert servico.autenticar(db, email, "NovaSenha#1", T0) is not None


def test_usuario_inexistente_na_administracao(db):
    with pytest.raises(servico.ErroUsuario, match="não encontrado"):
        servico.definir_ativo(db, "ninguem@obras.rj.gov.br", False)


def test_listar_sem_hash(db):
    _criar(db)
    [linha] = servico.listar(db)

    assert linha["email"] == "fulano@obras.rj.gov.br"
    assert linha["ativo"] is True
    assert "senha_hash" not in linha
