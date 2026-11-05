"""cria views do cruzamento SIAFE x planilha

Views comuns (calculadas na leitura) sobre siafe_flexvision e as tabelas planilha_*.
O SQL é literal e não importa o layout nem os modelos: uma migration futura que
alterar uma tabela usada aqui precisa recriar as views (o Postgres recusa o ALTER/DROP).
As views ficam fora de Base.metadata, então o autogenerate não as enxerga.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-04 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Abas na ordem de precedência do código: funil (31 > 89 > 342) e depois as auxiliares,
# na ordem do layout. A Tomada de Contas não tem código SEIOP.
_ABAS = [
    ("31 Convênios Vigentes 2025", "planilha_convenios_vigentes", "codigo_seiop"),
    ("89 Convênios", "planilha_convenios_transferidos", "codigo_seiop"),
    ("342 Convênios", "planilha_convenios_geral", "codigo_seiop"),
    ("Prest de Contas Conv_Execução", "planilha_prestacao_contas", "codigo_seiop"),
    ("Realinhado sem Exec_Expirado", "planilha_realinhado_sem_execucao", "codigo_seiop"),
    ("Não Realinhado Expirado", "planilha_nao_realinhado_expirado", "codigo_seiop"),
    ("Tomada de Contas", "planilha_tomada_contas", "NULL::text"),
    ("ACOMPANHAMENTO ESPECIAL", "planilha_acompanhamento_especial", "codigo_seiop"),
]

_LINHA = "\nUNION ALL\n".join(
    f"SELECT '{aba}'::text AS aba, {prioridade} AS prioridade, linha, linha_principal,\n"
    f"       numero_convenio, municipio, codigo_seobras, {seiop} AS codigo_seiop\n"
    f"FROM {tabela}"
    for prioridade, (aba, tabela, seiop) in enumerate(_ABAS, start=1)
)

_SALDOS_NULOS = "NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric"

# (nome, SQL), na ordem de criação; o downgrade remove na ordem inversa.
VIEWS: list[tuple[str, str]] = [
    # Todas as linhas das 8 abas, com chave e códigos.
    ("v_cruzamento_linha", _LINHA),
    # Uma linha por (aba, linha, tipo, código) não nulo.
    (
        "v_cruzamento_codigo_origem",
        """
SELECT l.aba, l.prioridade, l.linha, l.numero_convenio, l.municipio, c.tipo, c.codigo
FROM v_cruzamento_linha l
CROSS JOIN LATERAL (VALUES ('SEOBRAS'::text, l.codigo_seobras), ('SEIOP'::text, l.codigo_seiop)) AS c (tipo, codigo)
WHERE c.codigo IS NOT NULL
""",
    ),
    # Um convênio por chave da 342 (a primeira linha vence), com fase e códigos.
    (
        "v_convenio",
        """
WITH base AS (
    SELECT DISTINCT ON (numero_convenio, municipio) numero_convenio, municipio, linha, status_convenio
    FROM planilha_convenios_geral
    WHERE numero_convenio IS NOT NULL AND municipio IS NOT NULL
    ORDER BY numero_convenio, municipio, linha
)
SELECT
    b.numero_convenio,
    b.municipio,
    b.linha,
    b.status_convenio AS status,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM planilha_convenios_vigentes v
            WHERE v.numero_convenio = b.numero_convenio AND v.municipio = b.municipio
        ) THEN 'vigente'
        WHEN EXISTS (
            SELECT 1 FROM planilha_convenios_transferidos t
            WHERE t.numero_convenio = b.numero_convenio AND t.municipio = b.municipio
        ) THEN 'realinhado'
        ELSE 'historico'
    END AS fase,
    seobras.codigo AS codigo_seobras,
    seobras.aba AS aba_codigo_seobras,
    seiop.codigo AS codigo_seiop,
    seiop.aba AS aba_codigo_seiop
FROM base b
LEFT JOIN LATERAL (
    SELECT o.codigo, o.aba FROM v_cruzamento_codigo_origem o
    WHERE o.numero_convenio = b.numero_convenio AND o.municipio = b.municipio AND o.tipo = 'SEOBRAS'
    ORDER BY o.prioridade, o.linha
    LIMIT 1
) seobras ON true
LEFT JOIN LATERAL (
    SELECT o.codigo, o.aba FROM v_cruzamento_codigo_origem o
    WHERE o.numero_convenio = b.numero_convenio AND o.municipio = b.municipio AND o.tipo = 'SEIOP'
    ORDER BY o.prioridade, o.linha
    LIMIT 1
) seiop ON true
""",
    ),
    # Código distinto por convênio: um código repetido nos dois tipos conta uma vez.
    (
        "v_convenio_codigo",
        """
SELECT c.numero_convenio, c.municipio, x.codigo, array_agg(x.tipo ORDER BY x.tipo DESC) AS tipos
FROM v_convenio c
CROSS JOIN LATERAL (VALUES ('SEOBRAS'::text, c.codigo_seobras), ('SEIOP'::text, c.codigo_seiop)) AS x (tipo, codigo)
WHERE x.codigo IS NOT NULL
GROUP BY c.numero_convenio, c.municipio, x.codigo
""",
    ),
    # Cada linha do SIAFE das contas do convênio, sem agregação (inclusive as zeradas).
    (
        "v_convenio_registro",
        """
SELECT
    cc.numero_convenio,
    cc.municipio,
    s.ano,
    s.mes,
    s.conta_corrente,
    cc.tipos,
    s.conta_contabil,
    s.conta_contabil_nome,
    s.convenios_a_pagar,
    s.convenios_a_comprovar,
    s.convenios_a_aprovar,
    s.convenios_aprovados
FROM v_convenio_codigo cc
JOIN siafe_flexvision s ON s.conta_corrente = cc.codigo
""",
    ),
    # Saldo de cada código do convênio por mês (soma das contas contábeis do mês).
    (
        "v_convenio_saldo_codigo",
        """
SELECT
    numero_convenio,
    municipio,
    conta_corrente AS codigo,
    tipos,
    ano,
    mes,
    sum(convenios_a_pagar) AS convenios_a_pagar,
    sum(convenios_a_comprovar) AS convenios_a_comprovar,
    sum(convenios_a_aprovar) AS convenios_a_aprovar,
    sum(convenios_aprovados) AS convenios_aprovados
FROM v_convenio_registro
GROUP BY numero_convenio, municipio, conta_corrente, tipos, ano, mes
""",
    ),
    # Saldo do convênio por mês: soma dos seus códigos, nunca entre meses.
    (
        "v_convenio_saldo",
        """
SELECT
    numero_convenio,
    municipio,
    ano,
    mes,
    sum(convenios_a_pagar) AS convenios_a_pagar,
    sum(convenios_a_comprovar) AS convenios_a_comprovar,
    sum(convenios_a_aprovar) AS convenios_a_aprovar,
    sum(convenios_aprovados) AS convenios_aprovados
FROM v_convenio_saldo_codigo
GROUP BY numero_convenio, municipio, ano, mes
""",
    ),
    # Falhas de vínculo, com os saldos do último mês carregado quando envolvem uma conta.
    (
        "v_cruzamento_falha",
        f"""
WITH ultimo AS (
    SELECT (max(ano * 100 + mes) / 100)::smallint AS ano, (max(ano * 100 + mes) % 100)::smallint AS mes
    FROM siafe_flexvision
),
saldo_ultimo AS (
    SELECT
        s.conta_corrente,
        sum(s.convenios_a_pagar) AS convenios_a_pagar,
        sum(s.convenios_a_comprovar) AS convenios_a_comprovar,
        sum(s.convenios_a_aprovar) AS convenios_a_aprovar,
        sum(s.convenios_aprovados) AS convenios_aprovados
    FROM siafe_flexvision s
    JOIN ultimo u ON s.ano = u.ano AND s.mes = u.mes
    GROUP BY s.conta_corrente
)
SELECT
    'conta_siafe_sem_convenio'::text AS motivo,
    NULL::text AS numero_convenio,
    NULL::text AS municipio,
    NULL::text AS aba,
    NULL::integer AS linha,
    NULL::text AS tipo_codigo,
    c.conta_corrente AS codigo,
    NULL::text AS detalhe,
    u.ano,
    u.mes,
    su.convenios_a_pagar,
    su.convenios_a_comprovar,
    su.convenios_a_aprovar,
    su.convenios_aprovados
FROM (SELECT DISTINCT conta_corrente FROM siafe_flexvision) c
CROSS JOIN ultimo u
LEFT JOIN saldo_ultimo su ON su.conta_corrente = c.conta_corrente
WHERE NOT EXISTS (SELECT 1 FROM v_convenio_codigo cc WHERE cc.codigo = c.conta_corrente)

UNION ALL

SELECT
    'convenio_sem_codigo', v.numero_convenio, v.municipio, '342 Convênios', v.linha, NULL, NULL,
    format('fase: %s; status: %s', v.fase, coalesce(v.status, '-')),
    NULL::smallint, NULL::smallint, {_SALDOS_NULOS}
FROM v_convenio v
WHERE v.codigo_seobras IS NULL AND v.codigo_seiop IS NULL

UNION ALL

SELECT
    'codigo_fora_do_siafe', cc.numero_convenio, cc.municipio,
    CASE WHEN cc.codigo = v.codigo_seobras THEN v.aba_codigo_seobras ELSE v.aba_codigo_seiop END,
    NULL, array_to_string(cc.tipos, ','), cc.codigo, NULL,
    NULL::smallint, NULL::smallint, {_SALDOS_NULOS}
FROM v_convenio_codigo cc
JOIN v_convenio v ON v.numero_convenio = cc.numero_convenio AND v.municipio = cc.municipio
WHERE NOT EXISTS (SELECT 1 FROM siafe_flexvision s WHERE s.conta_corrente = cc.codigo)

UNION ALL

SELECT
    'codigo_divergente', v.numero_convenio, v.municipio, o.aba, min(o.linha), o.tipo, o.codigo,
    format('código escolhido: %s, da aba %s', e.codigo, e.aba),
    NULL::smallint, NULL::smallint, {_SALDOS_NULOS}
FROM v_convenio v
CROSS JOIN LATERAL (
    VALUES ('SEOBRAS'::text, v.codigo_seobras, v.aba_codigo_seobras), ('SEIOP'::text, v.codigo_seiop, v.aba_codigo_seiop)
) AS e (tipo, codigo, aba)
JOIN v_cruzamento_codigo_origem o
    ON o.numero_convenio = v.numero_convenio AND o.municipio = v.municipio AND o.tipo = e.tipo AND o.codigo <> e.codigo
GROUP BY v.numero_convenio, v.municipio, o.aba, o.tipo, o.codigo, e.codigo, e.aba

UNION ALL

SELECT
    'codigo_em_mais_de_um_convenio', NULL, NULL, NULL, NULL, NULL, cc.codigo,
    string_agg(cc.numero_convenio || ' - ' || cc.municipio, '; ' ORDER BY cc.numero_convenio, cc.municipio),
    NULL::smallint, NULL::smallint, {_SALDOS_NULOS}
FROM v_convenio_codigo cc
GROUP BY cc.codigo
HAVING count(*) > 1

UNION ALL

SELECT
    'linha_sem_convenio', l.numero_convenio, l.municipio, l.aba, l.linha, NULL, NULL,
    format('SEOBRAS: %s; SEIOP: %s', coalesce(l.codigo_seobras, '-'), coalesce(l.codigo_seiop, '-')),
    NULL::smallint, NULL::smallint, {_SALDOS_NULOS}
FROM v_cruzamento_linha l
WHERE l.aba <> '342 Convênios'
  AND l.linha_principal
  AND NOT EXISTS (
      SELECT 1 FROM v_convenio v WHERE v.numero_convenio = l.numero_convenio AND v.municipio = l.municipio
  )

UNION ALL

SELECT
    'chave_ausente_342', g.numero_convenio, g.municipio, '342 Convênios', g.linha, NULL, NULL,
    format('SEOBRAS: %s; SEIOP: %s', coalesce(g.codigo_seobras, '-'), coalesce(g.codigo_seiop, '-')),
    NULL::smallint, NULL::smallint, {_SALDOS_NULOS}
FROM planilha_convenios_geral g
WHERE g.numero_convenio IS NULL OR g.municipio IS NULL

UNION ALL

SELECT
    'chave_repetida_342', g.numero_convenio, g.municipio, '342 Convênios', g.linha, NULL, NULL,
    format('chave já usada pela linha %s', v.linha),
    NULL::smallint, NULL::smallint, {_SALDOS_NULOS}
FROM planilha_convenios_geral g
JOIN v_convenio v ON v.numero_convenio = g.numero_convenio AND v.municipio = g.municipio
WHERE g.linha <> v.linha
""",
    ),
]


def upgrade() -> None:
    for nome, sql in VIEWS:
        op.execute(f"CREATE VIEW {nome} AS\n{sql.strip()}")


def downgrade() -> None:
    for nome, _ in reversed(VIEWS):
        op.execute(f"DROP VIEW {nome}")
