"""CLI de usuários. Integração com o Postgres de TEST_DATABASE_URL (ver conftest)."""

import io

import pytest
from sqlalchemy import func, select

from app.auth import servico, usuarios
from app.models import Sessao, Usuario

SENHA = "Exemplo@123"
EMAIL = "denise@obras.rj.gov.br"


def _rodar(db, *argv, senha=SENHA):
    return usuarios.main(list(argv), engine=db, ler_senha=lambda _stdin: senha)


def _criar(db):
    return _rodar(db, "criar", EMAIL, "--nome", "Denise", "--perfil", "analista")


def test_criar_e_logar(db, capsys):
    assert _criar(db) == 0

    assert "criado" in capsys.readouterr().out
    assert servico.autenticar(db, EMAIL, SENHA) is not None


def test_criar_duplicado_sai_com_1(db, capsys):
    _criar(db)

    assert _criar(db) == 1
    assert "Já existe" in capsys.readouterr().err


def test_senha_curta_sai_com_1_sem_gravar(db, capsys):
    assert _rodar(db, "criar", EMAIL, "--nome", "D", "--perfil", "analista", senha="1234567") == 1

    assert "8 caracteres" in capsys.readouterr().err
    with db.connect() as conn:
        assert conn.scalar(select(func.count()).select_from(Usuario)) == 0


def test_perfil_invalido_recusado_pelo_argparse(db):
    with pytest.raises(SystemExit) as e:
        _rodar(db, "criar", EMAIL, "--nome", "D", "--perfil", "chefe")
    assert e.value.code == 2


def test_senha_nao_e_aceita_como_argumento(db):
    with pytest.raises(SystemExit):
        _rodar(db, "criar", EMAIL, "--nome", "D", "--perfil", "analista", "--senha", SENHA)


def test_desativar_derruba_sessoes_e_ativar_volta(db, capsys):
    _criar(db)
    uid = servico.autenticar(db, EMAIL, SENHA).id
    servico.abrir_sessao(db, uid, horas=12)

    assert _rodar(db, "desativar", EMAIL) == 0
    assert "desativado" in capsys.readouterr().out
    with db.connect() as conn:
        assert conn.scalar(select(func.count()).select_from(Sessao)) == 0
    assert servico.autenticar(db, EMAIL, SENHA) is None

    assert _rodar(db, "ativar", EMAIL) == 0
    assert servico.autenticar(db, EMAIL, SENHA) is not None


def test_trocar_senha(db):
    _criar(db)

    assert _rodar(db, "senha", EMAIL, senha="OutraSenha#9") == 0
    assert servico.autenticar(db, EMAIL, "OutraSenha#9") is not None


def test_email_inexistente_sai_com_1(db, capsys):
    assert _rodar(db, "desativar", "ninguem@obras.rj.gov.br") == 1
    assert "não encontrado" in capsys.readouterr().err


def test_listar_sem_hash(db, capsys):
    _criar(db)
    capsys.readouterr()

    assert _rodar(db, "listar") == 0
    saida = capsys.readouterr().out
    assert EMAIL in saida and "ativo" in saida
    assert "scrypt" not in saida and SENHA not in saida


def test_ler_senha_da_entrada_padrao():
    assert usuarios._ler_senha(True, io.StringIO(f"{SENHA}\r\n")) == SENHA
