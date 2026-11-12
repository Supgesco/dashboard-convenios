"""Persistência no banco de dados (PostgreSQL/SQLAlchemy) para criação, edição e exclusão de convênios."""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Connection, Engine, Table, delete, func, insert, select, update

from app.models import TABELAS_PLANILHA, PlanilhaImportacao
from app.planilha import transformacao as T


def _parse_data(valor: Any) -> date | None:
    """Converte string (ISO ou DD/MM/AAAA) ou date em objeto date, retornando None se vazio."""
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    texto = str(valor).strip()
    if not texto:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    return None


def _para_decimal(valor: Any) -> Decimal | None:
    """Converte valor numérico para Decimal com 2 casas decimais."""
    if valor is None:
        return None
    return Decimal(str(round(float(valor), 2)))


def _para_float(valor: Any) -> float | None:
    """Converte Decimal ou número para float arredondado em 2 casas."""
    if valor is None:
        return None
    return round(float(valor), 2)


def _obter_ou_criar_importacao_id(conn: Connection) -> int:
    """Retorna o ID da importação mais recente bem-sucedida ou cria um registro para cadastros manuais."""
    stmt = (
        select(PlanilhaImportacao.id)
        .where(PlanilhaImportacao.status == "sucesso")
        .order_by(PlanilhaImportacao.id.desc())
        .limit(1)
    )
    existente = conn.execute(stmt).scalar_one_or_none()
    if existente is not None:
        return int(existente)

    agora = datetime.now(timezone.utc)
    res = conn.execute(
        insert(PlanilhaImportacao)
        .values(
            inicio=agora,
            fim=agora,
            status="sucesso",
            arquivo="cadastro_manual",
            sha256="0" * 64,
            linhas_por_aba={},
            total_avisos=0,
            avisos_por_motivo={},
            avisos=[],
        )
        .returning(PlanilhaImportacao.id)
    )
    return int(res.scalar_one())


def _proxima_linha(conn: Connection, tabela: Table) -> int:
    """Retorna o próximo número sequencial de linha para inserção na tabela informada."""
    atual = conn.execute(select(func.coalesce(func.max(tabela.c.linha), 0))).scalar_one()
    return int(atual) + 1


def _normalizar_codigos(dados: dict[str, Any]) -> tuple[str | None, str | None]:
    """Normaliza os códigos SIAFE SEOBRAS e SEIOP conforme o padrão da planilha."""
    codigo_seobras = None
    seobras_bruto = dados.get("codigo_seobras")
    if seobras_bruto and str(seobras_bruto).strip():
        norm_s, _ = T.codigo(str(seobras_bruto).strip(), tipo="SEOBRAS")
        codigo_seobras = norm_s or str(seobras_bruto).strip()

    codigo_seiop = None
    seiop_bruto = dados.get("codigo_seiop")
    if seiop_bruto and str(seiop_bruto).strip():
        norm_i, _ = T.codigo(str(seiop_bruto).strip(), tipo="SEIOP")
        codigo_seiop = norm_i or str(seiop_bruto).strip()

    return codigo_seobras, codigo_seiop


def criar_convenio_db(engine: Engine, payload: dict[str, Any]):
    """Persiste um novo convênio nas tabelas do banco de dados de acordo com os recortes selecionados."""
    from app.routers.painel import LinhaConvenio

    num_bruto = str(payload.get("numero_convenio") or "").strip()
    num_norm, _ = T.numero_convenio(num_bruto)
    numero_convenio = num_norm or num_bruto

    mun_bruto = str(payload.get("municipio") or "").strip()
    mun_norm, _ = T.municipio(mun_bruto)
    municipio = mun_norm or mun_bruto

    codigo_seobras, codigo_seiop = _normalizar_codigos(payload)

    recortes_req = payload.get("recortes") or ["31", "89", "342"]
    recortes = [r for r in ("31", "89", "342") if r in recortes_req]
    if "342" not in recortes:
        recortes.append("342")

    termo_realinhamento = (payload.get("termo_realinhamento") or "").strip() or None
    status_bruto = (payload.get("status") or "").strip() or "vigente"
    if status_bruto == "sob realinhamento" and termo_realinhamento:
        status = f"sob realinhamento ({termo_realinhamento})"
        fase_padrao = f"{termo_realinhamento} Realinhamento"
    else:
        status = status_bruto
        fase_padrao = (
            "Vigente"
            if "31" in recortes
            else ("1º Realinhamento" if "89" in recortes else "342 Convênios")
        )
    fase = (payload.get("fase") or "").strip() or fase_padrao
    situacao_vigencia = (payload.get("situacao_vigencia") or "").strip() or status
    vigencia_final = _parse_data(payload.get("vigencia_final"))
    objeto = (payload.get("objeto") or "").strip() or None
    processo_sei = (payload.get("processo_celebracao") or payload.get("processo_sei") or "").strip() or None

    valor_total = float(payload.get("valor_total") or 0.0)
    repasse_estado = float(payload.get("repasse_estado") or 0.0)
    contrapartida = float(payload.get("contrapartida") or 0.0)
    investido_estado = float(payload.get("investido_estado") or 0.0)
    a_repassar = (
        float(payload["a_repassar"])
        if payload.get("a_repassar") is not None
        else max(0.0, round(repasse_estado - investido_estado, 2))
    )

    execucao_pct = round(100.0 * investido_estado / repasse_estado, 2) if repasse_estado > 0 else 0.0
    investido_sobre_total_pct = round(100.0 * investido_estado / valor_total, 2) if valor_total > 0 else 0.0

    t_geral = TABELAS_PLANILHA["342 Convênios"]
    t_vigentes = TABELAS_PLANILHA["31 Convênios Vigentes 2025"]
    t_transferidos = TABELAS_PLANILHA["89 Convênios"]
    t_prestacao = TABELAS_PLANILHA["Prest de Contas Conv_Execução"]
    t_tomada = TABELAS_PLANILHA["Tomada de Contas"]

    with engine.begin() as conn:
        importacao_id = _obter_ou_criar_importacao_id(conn)

        # Verifica se os códigos já aparecem em outro convênio para sinalizar compartilhamento
        codigos_ativos = [c for c in (codigo_seobras, codigo_seiop) if c]
        compartilhado = False
        if codigos_ativos:
            outro = conn.execute(
                select(t_geral.c.numero_convenio)
                .where(
                    (t_geral.c.numero_convenio != numero_convenio) | (t_geral.c.municipio != municipio),
                    t_geral.c.codigo_seobras.in_(codigos_ativos) | t_geral.c.codigo_seiop.in_(codigos_ativos),
                )
                .limit(1)
            ).first()
            compartilhado = outro is not None

        # 1. Tabela geral (342 Convênios)
        conn.execute(
            insert(t_geral).values(
                importacao_id=importacao_id,
                linha=_proxima_linha(conn, t_geral),
                linha_principal=True,
                colunas_corrigidas=False,
                municipio=municipio,
                numero_convenio=numero_convenio,
                codigo_seobras=codigo_seobras,
                codigo_seiop=codigo_seiop,
                objeto=objeto,
                status_convenio=status,
                realinhado=("89" in recortes and "31" not in recortes),
                vigencia_final=vigencia_final,
                situacao_vigencia=situacao_vigencia,
                processo_celebracao=processo_sei,
            )
        )

        # 2. Tabela vigentes (31)
        if "31" in recortes:
            conn.execute(
                insert(t_vigentes).values(
                    importacao_id=importacao_id,
                    linha=_proxima_linha(conn, t_vigentes),
                    linha_principal=True,
                    processo_celebracao=processo_sei,
                    municipio=municipio,
                    numero_convenio=numero_convenio,
                    codigo_seobras=codigo_seobras,
                    codigo_seiop=codigo_seiop,
                    objeto=objeto,
                    situacao=status,
                    vigencia_final=vigencia_final,
                    valor_total_inicial=_para_decimal(valor_total),
                    repasse_inicial=_para_decimal(repasse_estado),
                    contrapartida_inicial=_para_decimal(contrapartida),
                    total_investido=_para_decimal(investido_estado),
                    valor_a_repassar=_para_decimal(a_repassar),
                )
            )

        # 3. Tabela transferidos (89)
        if "89" in recortes:
            conn.execute(
                insert(t_transferidos).values(
                    importacao_id=importacao_id,
                    linha=_proxima_linha(conn, t_transferidos),
                    linha_principal=True,
                    processo_celebracao=processo_sei,
                    municipio=municipio,
                    numero_convenio=numero_convenio,
                    codigo_seobras=codigo_seobras,
                    codigo_seiop=codigo_seiop,
                    objeto=objeto,
                    realinhado=False,
                    vigencia_final=vigencia_final,
                    situacao_vigencia=situacao_vigencia,
                    status=status,
                    valor_total_inicial=_para_decimal(valor_total),
                    repasse_inicial=_para_decimal(repasse_estado),
                    contrapartida_inicial=_para_decimal(contrapartida),
                    total_investido_estado=_para_decimal(investido_estado),
                    valor_a_repassar=_para_decimal(a_repassar),
                )
            )

        # 4. Prestação de Contas (opcional)
        if payload.get("incluir_prestacao"):
            conn.execute(
                insert(t_prestacao).values(
                    importacao_id=importacao_id,
                    linha=_proxima_linha(conn, t_prestacao),
                    linha_principal=True,
                    municipio=municipio,
                    cnpj=(payload.get("cnpj") or "").strip() or None,
                    numero_convenio=numero_convenio,
                    codigo_seobras=codigo_seobras,
                    codigo_seiop=codigo_seiop,
                    parcela=int(payload.get("parcela") or 1),
                    valor_repasse=_para_decimal(repasse_estado),
                    processo=processo_sei,
                    valor_executado=_para_decimal(investido_estado),
                    baixa_apresentacao=(payload.get("baixa_apresentacao") or "").strip() or None,
                    baixa_aprovacao=(payload.get("baixa_aprovacao") or "").strip() or None,
                    situacao=status,
                )
            )

        # 5. Tomada de Contas (opcional)
        if payload.get("incluir_tomada"):
            conn.execute(
                insert(t_tomada).values(
                    importacao_id=importacao_id,
                    linha=_proxima_linha(conn, t_tomada),
                    linha_principal=True,
                    bloco=1,
                    municipio=municipio,
                    numero_convenio=numero_convenio,
                    codigo_seobras=codigo_seobras,
                    valor_siafe=_para_decimal(valor_total),
                    objeto=objeto,
                    parecer_comissao=(payload.get("parecer_comissao") or "").strip() or None,
                    processo_sei=processo_sei,
                    status=status,
                )
            )

    return LinhaConvenio(
        numero_convenio=numero_convenio,
        municipio=municipio,
        fase=fase,
        status=status,
        codigo_seobras=codigo_seobras,
        codigo_seiop=codigo_seiop,
        codigo_compartilhado=compartilhado,
        a_pagar=float(payload.get("a_pagar") or 0.0),
        a_comprovar=float(payload.get("a_comprovar") or 0.0),
        a_aprovar=float(payload.get("a_aprovar") or 0.0),
        aprovados=float(payload.get("aprovados") or 0.0),
        valor_total=valor_total if any(r in recortes for r in ("31", "89")) else None,
        repasse_estado=repasse_estado if any(r in recortes for r in ("31", "89")) else None,
        contrapartida=contrapartida if any(r in recortes for r in ("31", "89")) else None,
        investido_estado=investido_estado if any(r in recortes for r in ("31", "89")) else None,
        a_repassar=a_repassar if any(r in recortes for r in ("31", "89")) else None,
        execucao_pct=execucao_pct if any(r in recortes for r in ("31", "89")) else None,
        investido_sobre_total_pct=investido_sobre_total_pct if any(r in recortes for r in ("31", "89")) else None,
    )


def _atualizar_valores_contratuais_aba(
    conn: Connection,
    tabela: Table,
    col_investido: str,
    numero_convenio: str,
    municipio: str,
    alteracoes: dict[str, Any],
    extras: dict[str, Any],
) -> None:
    """Atualiza metadados e valores contratuais (iniciais ou realinhados) em uma aba contratual."""
    linhas = conn.execute(
        select(tabela).where(
            tabela.c.numero_convenio == numero_convenio,
            tabela.c.municipio == municipio,
        )
    ).mappings().all()
    if not linhas:
        return

    realinhado = any(r.get("valor_total_realinhado") is not None for r in linhas)
    valores: dict[str, Any] = {k: v for k, v in extras.items() if k in tabela.c}

    if "valor_total" in alteracoes and alteracoes["valor_total"] is not None:
        col = "valor_total_realinhado" if realinhado else "valor_total_inicial"
        valores[col] = _para_decimal(alteracoes["valor_total"])
    if "repasse_estado" in alteracoes and alteracoes["repasse_estado"] is not None:
        col = "repasse_realinhado" if realinhado else "repasse_inicial"
        valores[col] = _para_decimal(alteracoes["repasse_estado"])
    if "contrapartida" in alteracoes and alteracoes["contrapartida"] is not None:
        col = "contrapartida_realinhado" if realinhado else "contrapartida_inicial"
        valores[col] = _para_decimal(alteracoes["contrapartida"])
    if "investido_estado" in alteracoes and alteracoes["investido_estado"] is not None:
        valores[col_investido] = _para_decimal(alteracoes["investido_estado"])
    if "a_repassar" in alteracoes and alteracoes["a_repassar"] is not None:
        valores["valor_a_repassar"] = _para_decimal(alteracoes["a_repassar"])

    if not valores:
        return

    conn.execute(
        update(tabela)
        .where(tabela.c.numero_convenio == numero_convenio, tabela.c.municipio == municipio)
        .values(**valores)
    )


def atualizar_convenio_db(engine: Engine, numero_convenio: str, municipio: str, alteracoes: dict[str, Any]):
    """Atualiza no banco de dados os campos editáveis de um convênio e retorna a linha consolidada."""
    from app.painel import consultas as Q
    from app.routers.painel import LinhaConvenio

    if "codigo_seobras" in alteracoes and alteracoes["codigo_seobras"]:
        norm_s, _ = T.codigo(alteracoes["codigo_seobras"], tipo="SEOBRAS")
        if norm_s:
            alteracoes["codigo_seobras"] = norm_s
    if "codigo_seiop" in alteracoes and alteracoes["codigo_seiop"]:
        norm_i, _ = T.codigo(alteracoes["codigo_seiop"], tipo="SEIOP")
        if norm_i:
            alteracoes["codigo_seiop"] = norm_i

    t_geral = TABELAS_PLANILHA["342 Convênios"]
    t_vigentes = TABELAS_PLANILHA["31 Convênios Vigentes 2025"]
    t_transferidos = TABELAS_PLANILHA["89 Convênios"]

    with engine.begin() as conn:
        existe = conn.execute(
            select(t_geral.c.id)
            .where(t_geral.c.numero_convenio == numero_convenio, t_geral.c.municipio == municipio)
            .limit(1)
        ).first()
        if not existe:
            raise HTTPException(status_code=404, detail="Convênio não encontrado")

        valores_geral: dict[str, Any] = {}
        if "status" in alteracoes:
            valores_geral["status_convenio"] = alteracoes["status"]
        if "codigo_seobras" in alteracoes:
            valores_geral["codigo_seobras"] = alteracoes["codigo_seobras"]
        if "codigo_seiop" in alteracoes:
            valores_geral["codigo_seiop"] = alteracoes["codigo_seiop"]
        if "objeto" in alteracoes:
            valores_geral["objeto"] = alteracoes["objeto"]
        if "situacao_vigencia" in alteracoes:
            valores_geral["situacao_vigencia"] = alteracoes["situacao_vigencia"]

        if valores_geral:
            conn.execute(
                update(t_geral)
                .where(t_geral.c.numero_convenio == numero_convenio, t_geral.c.municipio == municipio)
                .values(**valores_geral)
            )

        extras_comuns: dict[str, Any] = {}
        for campo in ("codigo_seobras", "codigo_seiop", "objeto"):
            if campo in alteracoes:
                extras_comuns[campo] = alteracoes[campo]

        extras_vig = dict(extras_comuns)
        if "status" in alteracoes:
            extras_vig["situacao"] = alteracoes["status"]
        _atualizar_valores_contratuais_aba(
            conn, t_vigentes, "total_investido", numero_convenio, municipio, alteracoes, extras_vig
        )

        extras_transf = dict(extras_comuns)
        if "status" in alteracoes:
            extras_transf["status"] = alteracoes["status"]
        if "situacao_vigencia" in alteracoes:
            extras_transf["situacao_vigencia"] = alteracoes["situacao_vigencia"]
        _atualizar_valores_contratuais_aba(
            conn, t_transferidos, "total_investido_estado", numero_convenio, municipio, alteracoes, extras_transf
        )

        # Lê os dados consolidados atualizados direto do banco
        ultimo = Q.ultimo_mes(conn)
        ano, mes = ultimo if ultimo else (date.today().year, date.today().month)
        det = Q.detalhe_convenio(conn, numero_convenio, municipio, ano, mes)

    if det is None:
        raise HTTPException(status_code=404, detail="Convênio não encontrado")

    contratual = det["contratual"][0] if det["contratual"] else {}
    saldos = det["saldos"] or {}
    return LinhaConvenio(
        numero_convenio=det["numero_convenio"],
        municipio=det["municipio"],
        fase=det["fase"],
        status=det["status"],
        codigo_seobras=det["codigo_seobras"],
        codigo_seiop=det["codigo_seiop"],
        codigo_compartilhado=det["codigo_compartilhado"],
        a_pagar=float(saldos.get("a_pagar") or alteracoes.get("a_pagar") or 0.0),
        a_comprovar=float(saldos.get("a_comprovar") or alteracoes.get("a_comprovar") or 0.0),
        a_aprovar=float(saldos.get("a_aprovar") or alteracoes.get("a_aprovar") or 0.0),
        aprovados=float(saldos.get("aprovados") or alteracoes.get("aprovados") or 0.0),
        valor_total=_para_float(contratual.get("valor_total")),
        repasse_estado=_para_float(contratual.get("repasse_estado")),
        contrapartida=_para_float(contratual.get("contrapartida")),
        investido_estado=_para_float(contratual.get("investido_estado")),
        a_repassar=_para_float(contratual.get("a_repassar")),
        execucao_pct=_para_float(contratual.get("execucao_pct")),
        investido_sobre_total_pct=_para_float(contratual.get("investido_sobre_total_pct")),
    )


def remover_convenio_db(
    engine: Engine,
    numero_convenio: str,
    municipio: str,
    prestacao_id: int | None = None,
    tomada_id: int | None = None,
) -> dict[str, bool]:
    """Remove do banco de dados um convênio ou registro específico de prestação/tomada de contas."""
    with engine.begin() as conn:
        if prestacao_id is not None:
            t_prestacao = TABELAS_PLANILHA["Prest de Contas Conv_Execução"]
            res = conn.execute(delete(t_prestacao).where(t_prestacao.c.id == prestacao_id))
            if res.rowcount == 0:
                raise HTTPException(status_code=404, detail="Registro de prestação de contas não encontrado")
            return {"ok": True}

        if tomada_id is not None:
            t_tomada = TABELAS_PLANILHA["Tomada de Contas"]
            res = conn.execute(delete(t_tomada).where(t_tomada.c.id == tomada_id))
            if res.rowcount == 0:
                raise HTTPException(status_code=404, detail="Registro de tomada de contas não encontrado")
            return {"ok": True}

        if not numero_convenio or not municipio:
            raise HTTPException(status_code=422, detail="Informe numero e municipio ou prestacao_id/tomada_id")

        removidos = 0
        for tabela in TABELAS_PLANILHA.values():
            res = conn.execute(
                delete(tabela).where(
                    tabela.c.numero_convenio == numero_convenio,
                    tabela.c.municipio == municipio,
                )
            )
            removidos += res.rowcount or 0

        if removidos == 0:
            raise HTTPException(status_code=404, detail="Convênio não encontrado")

    return {"ok": True}


def atualizar_tomada_contas_db(engine: Engine, item_id: int, alteracoes: dict[str, Any]):
    """Atualiza um registro da tabela planilha_tomada_contas no banco de dados."""
    from app.routers.painel import LinhaTomadaContas

    t_tomada = TABELAS_PLANILHA["Tomada de Contas"]
    valores = {k: v for k, v in alteracoes.items() if k in t_tomada.c and k != "id"}
    if "valor_siafe" in valores and valores["valor_siafe"] is not None:
        valores["valor_siafe"] = _para_decimal(valores["valor_siafe"])

    with engine.begin() as conn:
        row = conn.execute(
            update(t_tomada).where(t_tomada.c.id == item_id).values(**valores).returning(t_tomada)
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Registro de tomada de contas não encontrado")

    return LinhaTomadaContas(
        id=int(row["id"]),
        municipio=row["municipio"],
        numero_convenio=row["numero_convenio"],
        codigo_seobras=row["codigo_seobras"],
        valor_siafe=_para_float(row["valor_siafe"]),
        objeto=row["objeto"],
        parecer_comissao=row["parecer_comissao"],
        processo_sei=row["processo_sei"],
        status=row["status"],
    )


def atualizar_prestacao_contas_db(engine: Engine, item_id: int, alteracoes: dict[str, Any]):
    """Atualiza um registro da tabela planilha_prestacao_contas no banco de dados."""
    from app.routers.painel import LinhaPrestacaoContas

    t_prestacao = TABELAS_PLANILHA["Prest de Contas Conv_Execução"]
    valores = {k: v for k, v in alteracoes.items() if k in t_prestacao.c and k != "id"}
    for campo_num in ("valor_repasse", "valor_executado"):
        if campo_num in valores and valores[campo_num] is not None:
            valores[campo_num] = _para_decimal(valores[campo_num])

    with engine.begin() as conn:
        row = conn.execute(
            update(t_prestacao).where(t_prestacao.c.id == item_id).values(**valores).returning(t_prestacao)
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Registro de prestação de contas não encontrado")

    return LinhaPrestacaoContas(
        id=int(row["id"]),
        item=row["item"],
        municipio=row["municipio"],
        cnpj=row["cnpj"],
        numero_convenio=row["numero_convenio"],
        codigo_seobras=row["codigo_seobras"],
        codigo_seiop=row["codigo_seiop"],
        parcela=row["parcela"],
        valor_repasse=_para_float(row["valor_repasse"]),
        processo=row["processo"],
        valor_executado=_para_float(row["valor_executado"]),
        baixa_apresentacao=row["baixa_apresentacao"],
        baixa_aprovacao=row["baixa_aprovacao"],
        observacao=row["observacao"],
        situacao=row["situacao"],
    )
