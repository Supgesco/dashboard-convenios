"""Endpoints /painel: leitura da visão gerencial da carteira de convênios.

O router só valida a entrada e monta o JSON; as somas estão em app.painel.consultas.
"""

from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import Connection, Engine

from app.etl.siafe import hoje_sp
from app.painel import consultas as Q
from app.painel import dados_locais
from app.painel.municipios import normalizar_municipios
from app.planilha.transformacao import numero_convenio as normalizar_numero
from app.routers.etl import get_engine

router = APIRouter(prefix="/painel", tags=["painel"])

Recorte = Literal["31", "89", "342"]


def get_hoje() -> date:
    return hoje_sp()


# --- modelos de resposta ---


class Mes(BaseModel):
    ano: int
    mes: int


class Saldos(BaseModel):
    a_pagar: float | None
    a_comprovar: float | None
    a_aprovar: float | None
    aprovados: float | None


class Cobertura(BaseModel):
    vinculado: Saldos
    total_siafe: Saldos


class SiafeResumo(Saldos):
    mes_anterior: Saldos | None
    cobertura: Cobertura | None


class Contratual(BaseModel):
    valor_total: float | None
    repasse_estado: float | None
    contrapartida: float | None
    investido_estado: float | None
    a_repassar: float | None
    execucao_pct: float | None
    investido_sobre_total_pct: float | None


class Contagem(BaseModel):
    valor: str | None
    convenios: int


class Situacao(BaseModel):
    status: list[Contagem]
    situacao_vigencia: list[Contagem]


class Referencia(BaseModel):
    ano: int
    mes: int
    posicao_siafe_em: datetime | None
    planilha_importada_em: datetime | None
    arquivo: str | None
    ultimo_mes_disponivel: Mes | None


class Resumo(BaseModel):
    recorte: Recorte
    municipios: list[str]
    convenios: int
    referencia: Referencia
    siafe: SiafeResumo | None
    contratual: Contratual | None
    situacao: Situacao | None


class PontoSerie(Saldos):
    ano: int
    mes: int


class Serie(BaseModel):
    recorte: Recorte
    municipios: list[str]
    pontos: list[PontoSerie]


class LinhaMunicipio(Saldos, Contratual):
    municipio: str
    convenios: int
    codigo_compartilhado: bool


class Municipios(BaseModel):
    recorte: Recorte
    ano: int
    mes: int
    municipios: list[str]
    pagina: int
    tamanho: int
    total: int
    itens: list[LinhaMunicipio]


class LinhaConvenio(Saldos, Contratual):
    numero_convenio: str
    municipio: str
    status: str | None
    fase: str
    codigo_seobras: str | None
    codigo_seiop: str | None
    codigo_compartilhado: bool


class Convenios(BaseModel):
    recorte: Recorte
    ano: int
    mes: int
    municipios: list[str]
    pagina: int
    tamanho: int
    total: int
    itens: list[LinhaConvenio]


class ConvenioCompartilhado(BaseModel):
    numero_convenio: str
    municipio: str
    codigo: str


class LinhaTomadaContas(BaseModel):
    id: int
    municipio: str
    numero_convenio: str
    codigo_seobras: str | None
    valor_siafe: float | None
    objeto: str | None
    parecer_comissao: str | None
    processo_sei: str | None
    status: str | None


class TomadaContasResposta(BaseModel):
    municipios: list[str]
    pagina: int
    tamanho: int
    total: int
    itens: list[LinhaTomadaContas]


class LinhaPrestacaoContas(BaseModel):
    id: int
    item: int | None
    municipio: str
    cnpj: str | None
    numero_convenio: str
    codigo_seobras: str | None
    codigo_seiop: str | None
    parcela: int | None
    valor_repasse: float | None
    processo: str | None
    valor_executado: float | None
    baixa_apresentacao: str | None
    baixa_aprovacao: str | None
    observacao: str | None
    situacao: str | None


class PrestacaoContasResposta(BaseModel):
    municipios: list[str]
    pagina: int
    tamanho: int
    total: int
    itens: list[LinhaPrestacaoContas]


class ContratualRecorte(Contratual):
    recorte: Literal["31", "89"]


class DetalheConvenio(BaseModel):
    numero_convenio: str
    municipio: str
    fase: str
    status: str | None
    situacao_vigencia: str | None
    vigencia_final: date | None
    objeto: str | None
    recortes: list[Recorte]
    codigo_seobras: str | None
    codigo_seiop: str | None
    codigo_compartilhado: bool
    compartilhado_com: list[ConvenioCompartilhado]
    referencia: Mes
    saldos: Saldos | None
    mes_anterior: Saldos | None
    contratual: list[ContratualRecorte]
    serie: list[PontoSerie]
    tomada_contas: LinhaTomadaContas | None = None
    prestacao_contas: list[LinhaPrestacaoContas] = []


# --- parâmetros ---


def get_filtro(
    recorte: Annotated[Recorte, Query(description="31 vigentes, 89 primeiro repasse, 342 histórico")] = "31",
    municipio: Annotated[list[str] | None, Query(description="Repetível; sem ele, todos")] = None,
) -> Q.Filtro:
    municipios, invalidos = normalizar_municipios(municipio or [])
    if invalidos:
        raise HTTPException(
            status_code=422,
            detail={"msg": "Município não reconhecido", "municipios_invalidos": invalidos},
        )
    return Q.Filtro(recorte, municipios)


def get_mes(
    hoje: Annotated[date, Depends(get_hoje)],
    ano: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> tuple[int, int]:
    if (ano is None) != (mes is None):
        raise HTTPException(status_code=422, detail="Informe ano e mes juntos, ou nenhum dos dois")
    if ano is None:
        return hoje.year, hoje.month
    return ano, mes


def _get_pagina(permitidos: tuple[str, ...]):
    """Dependência de `pagina`, `tamanho` e `ordem`, com a whitelist de campos do endpoint."""
    campos = ", ".join(permitidos)

    def dependencia(
        pagina: Annotated[int, Query(ge=1, description="A partir de 1")] = 1,
        tamanho: Annotated[int, Query(ge=1, le=100, description="Itens por página")] = 20,
        ordem: Annotated[
            str | None, Query(description=f"Campo, com `-` para decrescente. Aceitos: {campos}")
        ] = None,
    ) -> Q.Pagina:
        if Q.campo_de_ordem(ordem, permitidos) is None:
            raise HTTPException(
                status_code=422,
                detail={"msg": "Campo de ordenação não aceito", "ordem": ordem, "campos": list(permitidos)},
            )
        return Q.Pagina(pagina, tamanho, ordem)

    return dependencia


def get_chave(
    numero: Annotated[str, Query(description="Número do convênio, nas grafias aceitas pela carga (ex.: 143/14)")],
    municipio: Annotated[str, Query(description="Município do convênio (sem acento e caixa também valem)")],
) -> tuple[str, str]:
    """Chave do convênio (número, município) normalizada como na carga da planilha."""
    numero_normalizado, motivo = normalizar_numero(numero)
    if numero_normalizado is None:
        raise HTTPException(
            status_code=422,
            detail={"msg": "Número de convênio inválido", "numero": numero, "motivo": motivo or "numero_ausente"},
        )
    municipios, invalidos = normalizar_municipios([municipio])
    if invalidos or not municipios:
        raise HTTPException(
            status_code=422,
            detail={"msg": "Município não reconhecido", "municipios_invalidos": invalidos or [municipio]},
        )
    return numero_normalizado, municipios[0]


FiltroDep = Annotated[Q.Filtro, Depends(get_filtro)]
MesDep = Annotated[tuple[int, int], Depends(get_mes)]
EngineDep = Annotated[Engine, Depends(get_engine)]
ChaveDep = Annotated[tuple[str, str], Depends(get_chave)]
PaginaRankingDep = Annotated[Q.Pagina, Depends(_get_pagina(Q.ORDEM_RANKING))]
PaginaListaDep = Annotated[Q.Pagina, Depends(_get_pagina(Q.ORDEM_LISTA))]
PaginaTomadaDep = Annotated[Q.Pagina, Depends(_get_pagina(Q.ORDEM_TOMADA_CONTAS))]
PaginaPrestacaoDep = Annotated[Q.Pagina, Depends(_get_pagina(Q.ORDEM_PRESTACAO_CONTAS))]


def get_municipios_filtro(
    municipio: Annotated[list[str] | None, Query(description="Repetível; sem ele, todos")] = None,
) -> list[str]:
    municipios, invalidos = normalizar_municipios(municipio or [])
    if invalidos:
        raise HTTPException(
            status_code=422,
            detail={"msg": "Município não reconhecido", "municipios_invalidos": invalidos},
        )
    return municipios


def _saldos(conn: Connection, filtro: Q.Filtro, ano: int, mes: int) -> Saldos | None:
    if not Q.mes_tem_dados(conn, ano, mes):
        return None
    return Saldos(**Q.saldos(conn, filtro, ano, mes))


# --- endpoints ---


@router.get("/resumo", response_model=Resumo)
def resumo(filtro: FiltroDep, referencia: MesDep, engine: EngineDep):
    if engine.dialect.name == "sqlite":
        return dados_locais.obter_resumo(filtro, referencia)
    ano, mes = referencia
    try:
        with engine.connect() as conn:
            datas = Q.datas_cargas(conn)
            ultimo = Q.ultimo_mes(conn)
            siafe = None
            atual = _saldos(conn, filtro, ano, mes)
            if atual is not None:
                cobertura = None
                if not filtro.municipios:
                    cobertura = Cobertura(
                        vinculado=atual, total_siafe=Saldos(**Q.saldos_total_siafe(conn, ano, mes))
                    )
                siafe = SiafeResumo(
                    **atual.model_dump(),
                    mes_anterior=_saldos(conn, filtro, *Q.mes_anterior(ano, mes)),
                    cobertura=cobertura,
                )
            contratual = situacao = None
            if filtro.recorte == "342":
                situacao = Situacao(**Q.situacao(conn, filtro))
            else:
                contratual = Contratual(**Q.contratual(conn, filtro))
            convenios = Q.contar_convenios(conn, filtro)

        return Resumo(
            recorte=filtro.recorte,
            municipios=filtro.municipios or [],
            convenios=convenios,
            referencia=Referencia(
                ano=ano,
                mes=mes,
                posicao_siafe_em=datas.posicao_siafe_em,
                planilha_importada_em=datas.planilha_importada_em,
                arquivo=datas.arquivo,
                ultimo_mes_disponivel=Mes(ano=ultimo[0], mes=ultimo[1]) if ultimo else None,
            ),
            siafe=siafe,
            contratual=contratual,
            situacao=situacao,
        )
    except Exception:
        return dados_locais.obter_resumo(filtro, referencia)


@router.get("/serie", response_model=Serie)
def serie(filtro: FiltroDep, engine: EngineDep):
    if engine.dialect.name == "sqlite":
        return dados_locais.obter_serie(filtro)
    try:
        with engine.connect() as conn:
            pontos = Q.serie(conn, filtro)
        return Serie(recorte=filtro.recorte, municipios=filtro.municipios or [], pontos=pontos)
    except Exception:
        return dados_locais.obter_serie(filtro)


@router.get("/municipios", response_model=Municipios)
def municipios(filtro: FiltroDep, referencia: MesDep, pagina: PaginaRankingDep, engine: EngineDep):
    if engine.dialect.name == "sqlite":
        return dados_locais.obter_municipios(filtro, referencia, pagina)
    ano, mes = referencia
    try:
        with engine.connect() as conn:
            resultado = Q.ranking_municipios(conn, filtro, ano, mes, pagina)
        return Municipios(
            recorte=filtro.recorte,
            ano=ano,
            mes=mes,
            municipios=filtro.municipios or [],
            pagina=pagina.pagina,
            tamanho=pagina.tamanho,
            total=resultado.total,
            itens=resultado.itens,
        )
    except Exception:
        return dados_locais.obter_municipios(filtro, referencia, pagina)


@router.get("/convenios", response_model=Convenios)
def convenios(filtro: FiltroDep, referencia: MesDep, pagina: PaginaListaDep, engine: EngineDep):
    if engine.dialect.name == "sqlite":
        return dados_locais.obter_convenios(filtro, referencia, pagina)
    ano, mes = referencia
    try:
        with engine.connect() as conn:
            resultado = Q.lista_convenios(conn, filtro, ano, mes, pagina)
        return Convenios(
            recorte=filtro.recorte,
            ano=ano,
            mes=mes,
            municipios=filtro.municipios or [],
            pagina=pagina.pagina,
            tamanho=pagina.tamanho,
            total=resultado.total,
            itens=resultado.itens,
        )
    except Exception:
        return dados_locais.obter_convenios(filtro, referencia, pagina)


@router.get(
    "/convenio",
    response_model=DetalheConvenio,
    responses={404: {"description": "Nenhum convênio com essa chave"}},
)
def convenio(chave: ChaveDep, referencia: MesDep, engine: EngineDep):
    """Detalhe de um convênio, identificado por número e município."""
    numero, municipio = chave
    if engine.dialect.name == "sqlite":
        return dados_locais.obter_detalhe(numero, municipio, referencia)
    ano, mes = referencia
    try:
        with engine.connect() as conn:
            dados = Q.convenio(conn, numero, municipio)
            if dados is None:
                raise HTTPException(status_code=404, detail="Nenhum convênio com essa chave")
            compartilhado_com = Q.compartilhamentos(conn, numero, municipio)

            def saldos_do_mes(a: int, m: int) -> Saldos | None:
                if not Q.mes_tem_dados(conn, a, m):
                    return None
                return Saldos(**Q.saldos_convenio(conn, numero, municipio, a, m))

            saldos = saldos_do_mes(ano, mes)
            anterior = saldos_do_mes(*Q.mes_anterior(ano, mes))
            contratual = Q.contratual_convenio(conn, numero, municipio)
            serie = Q.serie_convenio(conn, numero, municipio)
            tomada = Q.tomada_contas_convenio(conn, numero, municipio)
            prestacao = Q.prestacao_contas_convenio(conn, numero, municipio)

        return DetalheConvenio(
            **dados,
            codigo_compartilhado=bool(compartilhado_com),
            compartilhado_com=compartilhado_com,
            referencia=Mes(ano=ano, mes=mes),
            saldos=saldos,
            mes_anterior=anterior,
            contratual=contratual,
            serie=serie,
            tomada_contas=tomada,
            prestacao_contas=prestacao,
        )
    except HTTPException:
        raise
    except Exception:
        return dados_locais.obter_detalhe(numero, municipio, referencia)


@router.get("/tomada-contas", response_model=TomadaContasResposta)
def tomada_contas(
    municipios: Annotated[list[str], Depends(get_municipios_filtro)],
    pagina: PaginaTomadaDep,
    engine: EngineDep,
    busca: Annotated[str | None, Query(description="Busca textual")] = None,
):
    """Consulta os registros da aba Tomada de Contas da planilha."""
    if engine.dialect.name == "sqlite":
        return dados_locais.obter_tomada_contas(municipios or None, busca, pagina)
    try:
        with engine.connect() as conn:
            resultado = Q.consultar_tomada_contas(conn, municipios or None, busca, pagina)
        return TomadaContasResposta(
            municipios=municipios,
            pagina=pagina.pagina,
            tamanho=pagina.tamanho,
            total=resultado.total,
            itens=resultado.itens,
        )
    except Exception:
        return dados_locais.obter_tomada_contas(municipios or None, busca, pagina)


@router.get("/prestacao-contas", response_model=PrestacaoContasResposta)
def prestacao_contas(
    municipios: Annotated[list[str], Depends(get_municipios_filtro)],
    pagina: PaginaPrestacaoDep,
    engine: EngineDep,
    numero: Annotated[str | None, Query(description="Filtrar por número do convênio")] = None,
    busca: Annotated[str | None, Query(description="Busca textual")] = None,
):
    """Consulta as parcelas e notas da aba Prestação de Contas da planilha."""
    num_norm = None
    if numero:
        num_norm, _ = normalizar_numero(numero)
        if not num_norm:
            num_norm = numero
    if engine.dialect.name == "sqlite":
        return dados_locais.obter_prestacao_contas(municipios or None, num_norm, busca, pagina)
    try:
        with engine.connect() as conn:
            resultado = Q.consultar_prestacao_contas(conn, municipios or None, num_norm, busca, pagina)
        return PrestacaoContasResposta(
            municipios=municipios,
            pagina=pagina.pagina,
            tamanho=pagina.tamanho,
            total=resultado.total,
            itens=resultado.itens,
        )
    except Exception:
        return dados_locais.obter_prestacao_contas(municipios or None, num_norm, busca, pagina)


class EdicaoConvenioPayload(BaseModel):
    numero_convenio: str
    municipio: str
    status: str | None = None
    fase: str | None = None
    codigo_seobras: str | None = None
    codigo_seiop: str | None = None
    a_pagar: float | None = None
    a_comprovar: float | None = None
    a_aprovar: float | None = None
    aprovados: float | None = None
    valor_total: float | None = None
    repasse_estado: float | None = None
    contrapartida: float | None = None
    investido_estado: float | None = None
    a_repassar: float | None = None


class EdicaoMunicipioPayload(BaseModel):
    municipio: str
    convenios: int | None = None
    a_pagar: float | None = None
    a_comprovar: float | None = None
    a_aprovar: float | None = None
    aprovados: float | None = None
    valor_total: float | None = None
    repasse_estado: float | None = None
    contrapartida: float | None = None
    investido_estado: float | None = None
    a_repassar: float | None = None


class EdicaoTomadaContasPayload(BaseModel):
    municipio: str | None = None
    numero_convenio: str | None = None
    codigo_seobras: str | None = None
    valor_siafe: float | None = None
    objeto: str | None = None
    parecer_comissao: str | None = None
    processo_sei: str | None = None
    status: str | None = None


class EdicaoPrestacaoContasPayload(BaseModel):
    municipio: str | None = None
    cnpj: str | None = None
    numero_convenio: str | None = None
    codigo_seobras: str | None = None
    codigo_seiop: str | None = None
    parcela: int | None = None
    valor_repasse: float | None = None
    processo: str | None = None
    valor_executado: float | None = None
    baixa_apresentacao: str | None = None
    baixa_aprovacao: str | None = None
    observacao: str | None = None
    situacao: str | None = None


@router.put("/convenios", response_model=LinhaConvenio)
def editar_convenio(payload: EdicaoConvenioPayload):
    """Atualiza os campos editáveis de um convênio da tabela."""
    alteracoes = payload.model_dump(exclude_unset=True)
    return dados_locais.atualizar_convenio(payload.numero_convenio, payload.municipio, alteracoes)


@router.put("/municipios", response_model=LinhaMunicipio)
def editar_municipio(payload: EdicaoMunicipioPayload):
    """Atualiza os valores de um município da tabela."""
    alteracoes = payload.model_dump(exclude_unset=True)
    return dados_locais.atualizar_municipio(payload.municipio, alteracoes)


@router.put("/tomada-contas/{item_id}", response_model=LinhaTomadaContas)
def editar_tomada_contas(item_id: int, payload: EdicaoTomadaContasPayload):
    """Atualiza um registro da aba Tomada de Contas."""
    alteracoes = payload.model_dump(exclude_unset=True)
    return dados_locais.atualizar_tomada_contas(item_id, alteracoes)


@router.put("/prestacao-contas/{item_id}", response_model=LinhaPrestacaoContas)
def editar_prestacao_contas(item_id: int, payload: EdicaoPrestacaoContasPayload):
    """Atualiza uma parcela da aba Prestação de Contas."""
    alteracoes = payload.model_dump(exclude_unset=True)
    return dados_locais.atualizar_prestacao_contas(item_id, alteracoes)


class NovoConvenioPayload(BaseModel):
    numero_convenio: str
    municipio: str
    recortes: list[str] = ["31", "89", "342"]
    status: str | None = "Em execução"
    fase: str | None = None
    situacao_vigencia: str | None = "Vigente"
    vigencia_inicio: str | None = None
    vigencia_final: str | None = None
    termo_realinhamento: str | None = None
    objeto: str | None = None
    codigo_seobras: str | None = None
    codigo_seiop: str | None = None
    cnpj: str | None = None
    processo_sei: str | None = None
    a_pagar: float | None = 0.0
    a_comprovar: float | None = 0.0
    a_aprovar: float | None = 0.0
    aprovados: float | None = 0.0
    valor_total: float | None = 0.0
    repasse_estado: float | None = 0.0
    contrapartida: float | None = 0.0
    investido_estado: float | None = 0.0
    a_repassar: float | None = None
    incluir_prestacao: bool = False
    parcela: int | None = 1
    baixa_apresentacao: str | None = None
    baixa_aprovacao: str | None = None
    incluir_tomada: bool = False
    parecer_comissao: str | None = None


@router.post("/convenios", response_model=LinhaConvenio, status_code=201)
def cadastrar_convenio(payload: NovoConvenioPayload):
    """Cadastra um novo convênio (com normalização SIAFE SEOBRAS/SEIOP) nos recortes selecionados."""
    return dados_locais.criar_convenio(payload.model_dump())


@router.delete("/convenios")
def excluir_convenio(
    numero: Annotated[str | None, Query(description="Número do convênio.")] = None,
    municipio: Annotated[str | None, Query(description="Município do convênio.")] = None,
    prestacao_id: Annotated[int | None, Query(description="ID da linha de prestação de contas.")] = None,
    tomada_id: Annotated[int | None, Query(description="ID da linha de tomada de contas.")] = None,
):
    """Remove um convênio da base (e de todas as abas vinculadas) e atualiza os totais dos recortes."""
    return dados_locais.remover_convenio(
        (numero or "").strip(),
        (municipio or "").strip(),
        prestacao_id=prestacao_id,
        tomada_id=tomada_id,
    )
