"""Serviço de carga. Os testes de integração usam o Postgres de TEST_DATABASE_URL (ver conftest)."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.config import Settings
from app.etl import siafe as etl
from app.models import EtlExecucao, SiafeFlexvision
from app.siafe.client import SiafeError

HOJE = date(2023, 3, 15)  # 3 meses: 2023-01..03, mantém os testes rápidos


def test_periodos_ate_novembro_de_2026():
    p = etl.periodos(date(2026, 11, 3))
    assert len(p) == 47
    assert p[0] == (2023, 1)
    assert p[-1] == (2026, 11)
    assert (2023, 12) in p and (2024, 1) in p


def test_periodos_em_janeiro_de_2023():
    assert etl.periodos(date(2023, 1, 31)) == [(2023, 1)]


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        siafe_url="https://siafe.example/api",
        siafe_user="u",
        siafe_password="p",
        siafe_ug="000001",
        siafe_consulta="C",
        database_url="postgresql+psycopg2://u:p@localhost/db",
    )


def _linha(conta: str, valor: str) -> dict:
    return {
        "Unidade Gestora": "000001 - UNIDADE FICTICIA",
        "Conta Corrente": conta,
        "Conta contábil": "800000001 - CONTA FICTICIA",
        "Credor": " - ",
        "Convenios a pagar": "0",
        "Convênios a comprovar": "0",
        "Convênios a aprovar": "0",
        "Convênios aprovados": valor,
    }


class FakeSiafe:
    """Substitui o SiafeClient: devolve `por_mes[(ano, mes)]` ou levanta a exceção configurada."""

    def __init__(self, por_mes: dict, falha_em: tuple[int, int] | None = None):
        self.por_mes = por_mes
        self.falha_em = falha_em
        self.chamadas: list[tuple[int, int]] = []

    def __call__(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *a):
        pass

    def consultar(self, ano, mes):
        self.chamadas.append((ano, mes))
        if (ano, mes) == self.falha_em:
            raise SiafeError("SIAFE indisponível após 3 tentativas: GET respondeu 503")
        return self.por_mes.get((ano, mes), [])


def _contar(engine):
    with engine.connect() as conn:
        return conn.scalar(select(func.count()).select_from(SiafeFlexvision))


def _execucoes(engine):
    with engine.connect() as conn:
        return conn.execute(select(EtlExecucao).order_by(EtlExecucao.id)).all()


def _carregar(engine, settings, fake, origem="cli"):
    reserva = etl.reservar(engine, origem)
    return etl.executar(engine, reserva, settings=settings, cliente=fake, hoje=HOJE)


def test_carga_substitui_todos_os_registros(db, settings):
    primeira = FakeSiafe({(2023, 1): [_linha("000001", "1.00"), _linha("000002", "2.00")]})
    assert _carregar(db, settings, primeira) == 2
    assert primeira.chamadas == [(2023, 1), (2023, 2), (2023, 3)]

    segunda = FakeSiafe({(2023, 2): [_linha("000009", "357426387.85")]})
    assert _carregar(db, settings, segunda) == 1

    with db.connect() as conn:
        linhas = conn.execute(select(SiafeFlexvision)).all()
    assert len(linhas) == 1
    assert (linhas[0].ano, linhas[0].mes, linhas[0].conta_corrente) == (2023, 2, "000009")
    assert linhas[0].convenios_aprovados == Decimal("357426387.85")

    execs = _execucoes(db)
    assert [e.status for e in execs] == ["sucesso", "sucesso"]
    assert linhas[0].execucao_id == execs[1].id
    assert execs[1].registros == 1 and execs[1].fim is not None


def test_falha_no_meio_mantem_dados_anteriores(db, settings):
    _carregar(db, settings, FakeSiafe({(2023, 1): [_linha("000001", "1.00")]}))

    falha = FakeSiafe({(2023, 1): [_linha("000002", "5.00")]}, falha_em=(2023, 2))
    with pytest.raises(SiafeError):
        _carregar(db, settings, falha)

    with db.connect() as conn:
        contas = conn.scalars(select(SiafeFlexvision.conta_corrente)).all()
    assert contas == ["000001"]

    ultima = _execucoes(db)[-1]
    assert ultima.status == "falha"
    assert ultima.fim is not None
    assert "503" in ultima.erro


def test_resposta_invalida_falha_sem_alterar_dados(db, settings):
    _carregar(db, settings, FakeSiafe({(2023, 1): [_linha("000001", "1.00")]}))

    with pytest.raises(ValueError, match="2023-03"):
        _carregar(db, settings, FakeSiafe({(2023, 3): [_linha("000002", "abc")]}))

    assert _contar(db) == 1
    assert _execucoes(db)[-1].status == "falha"


def test_segunda_carga_com_lock_ocupado_e_recusada(db, settings):
    reserva = etl.reservar(db, "http")
    try:
        fake = FakeSiafe({})
        with pytest.raises(etl.CargaEmAndamento) as exc:
            _carregar(db, settings, fake)
        assert exc.value.execucao_id == reserva.execucao_id
        assert fake.chamadas == []
    finally:
        reserva.liberar()

    assert [e.status for e in _execucoes(db)] == ["em_andamento"]


def test_execucao_orfa_e_marcada_como_interrompida(db, settings):
    orfa = etl.reservar(db, "http")
    orfa.liberar()  # simula processo que morreu sem finalizar

    _carregar(db, settings, FakeSiafe({}))

    execs = _execucoes(db)
    assert execs[0].status == "falha" and "interrompida" in execs[0].erro
    assert execs[1].status == "sucesso"


def test_cli_sucesso(db, settings, capsys):
    fake = FakeSiafe({(2023, 1): [_linha("000001", "1.00")]})
    codigo = etl.main([], engine=db, settings=settings, cliente=fake, hoje=HOJE)

    assert codigo == 0
    assert "1 registros" in capsys.readouterr().out


def test_cli_falha(db, settings, capsys):
    fake = FakeSiafe({}, falha_em=(2023, 1))
    codigo = etl.main([], engine=db, settings=settings, cliente=fake, hoje=HOJE)

    assert codigo != 0
    assert "503" in capsys.readouterr().err


def test_cli_com_carga_em_andamento(db, settings, capsys):
    reserva = etl.reservar(db, "http")
    try:
        fake = FakeSiafe({})
        codigo = etl.main([], engine=db, settings=settings, cliente=fake, hoje=HOJE)
    finally:
        reserva.liberar()

    assert codigo != 0
    assert fake.chamadas == []
    assert "em andamento" in capsys.readouterr().err
