"""Domínios usados na normalização: municípios do RJ e vocabulários das categorias.

Tudo é comparado pela `chave()` (sem acentos, maiúsculas, espaços e pontuação),
então variações como "Vigente " / "vigente" ou "RioClaro" / "Rio Claro" já casam
sem entrada própria. Aliases só para abreviações que a chave não resolve.
"""

import unicodedata


def chave(texto: str) -> str:
    """Forma de comparação: sem acentos, casefold e só caracteres alfanuméricos."""
    decomposto = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(ch for ch in decomposto if not unicodedata.combining(ch))
    return "".join(ch for ch in sem_acento.casefold() if ch.isalnum())


# Lista oficial do IBGE (UF 33), 92 municípios.
MUNICIPIOS_RJ: tuple[str, ...] = (
    "Angra dos Reis", "Aperibé", "Araruama", "Areal", "Armação dos Búzios", "Arraial do Cabo",
    "Barra Mansa", "Barra do Piraí", "Belford Roxo", "Bom Jardim", "Bom Jesus do Itabapoana",
    "Cabo Frio", "Cachoeiras de Macacu", "Cambuci", "Campos dos Goytacazes", "Cantagalo",
    "Carapebus", "Cardoso Moreira", "Carmo", "Casimiro de Abreu", "Comendador Levy Gasparian",
    "Conceição de Macabu", "Cordeiro", "Duas Barras", "Duque de Caxias",
    "Engenheiro Paulo de Frontin", "Guapimirim", "Iguaba Grande", "Itaboraí", "Itaguaí",
    "Italva", "Itaocara", "Itaperuna", "Itatiaia", "Japeri", "Laje do Muriaé", "Macaé",
    "Macuco", "Magé", "Mangaratiba", "Maricá", "Mendes", "Mesquita", "Miguel Pereira",
    "Miracema", "Natividade", "Nilópolis", "Niterói", "Nova Friburgo", "Nova Iguaçu",
    "Paracambi", "Paraty", "Paraíba do Sul", "Paty do Alferes", "Petrópolis", "Pinheiral",
    "Piraí", "Porciúncula", "Porto Real", "Quatis", "Queimados", "Quissamã", "Resende",
    "Rio Bonito", "Rio Claro", "Rio das Flores", "Rio das Ostras", "Rio de Janeiro",
    "Santa Maria Madalena", "Santo Antônio de Pádua", "Sapucaia", "Saquarema", "Seropédica",
    "Silva Jardim", "Sumidouro", "São Fidélis", "São Francisco de Itabapoana", "São Gonçalo",
    "São José de Ubá", "São José do Vale do Rio Preto", "São João da Barra",
    "São João de Meriti", "São Pedro da Aldeia", "São Sebastião do Alto", "Tanguá",
    "Teresópolis", "Trajano de Moraes", "Três Rios", "Valença", "Varre-Sai", "Vassouras",
    "Volta Redonda",
)

# Abreviações observadas na planilha -> nome oficial.
ALIASES_MUNICIPIO: dict[str, str] = {
    "São J Vale do Rio Preto": "São José do Vale do Rio Preto",
    "SÃO J. DO V. DO RIO PRETO": "São José do Vale do Rio Preto",
    "SÃO JOSÉ DO VALE RIO PRETO": "São José do Vale do Rio Preto",
    "São F Do Itabapoana": "São Francisco de Itabapoana",
    "COMENDADOR L. GASPARIAN": "Comendador Levy Gasparian",
    "ENGENHEIRO P. DE FRONTIN": "Engenheiro Paulo de Frontin",
}

MUNICIPIO_POR_CHAVE: dict[str, str] = {
    **{chave(apelido): oficial for apelido, oficial in ALIASES_MUNICIPIO.items()},
    **{chave(nome): nome for nome in MUNICIPIOS_RJ},
}

# Vocabulários das colunas categóricas: forma canônica de cada valor.
# Variações de caixa, acento e espaço caem na mesma chave e não precisam de entrada.
VOCABULARIOS: dict[str, tuple[str, ...]] = {
    "status_convenio": (
        "Vigente",
        "Não Vigente",
        "Concluído",
        "Concluído/Aprovado",
        "Expirado",
        "Expirado/Cancelado",
        "Expirado/Concluído",
        "Tomada de Contas",
    ),
    "situacao_vigencia": ("Vigente", "Expirado", "Em andamento"),
    "status_transferidos": (
        "Em Andamento",
        "A Realinhar",
        "Vistoriar Obra",
        "Aguardando repasse para reinício da Obra",
        "Objeto do Convênio concluído",
        "Objeto do Convênio concluído com recurso municipal",
        "Objeto com Convênio sendo concluído com recurso municipal",
        "Objeto Concluído - Uruan",
        "Concluído - 3 últimas parcelas pagas pela SEIOP",
        "Conclusão anterior à passagem para SEIOP",
        "Município não concluiu objeto",
        "Município concluiu a obra com recurso federal",
        "Município solicitou repasse da última parcela",
        "Município solicitou cancelamento do Convênio",
        "Obra paralisada pelo MP / Convênio não renovado pelo inviabilidade da execução da obra",
        "Não continuado por extinsão do programa",
    ),
    "situacao_vigentes": ("Vigente", "Vigente / Realinhado", "Vigente / Não Realinhado"),
    "andamento_vigentes": (
        "Em Andamento",
        "Não Realinhado",
        "Aguardando repasse para reinício da Obra",
        "Concluído",
    ),
    "situacao_prestacao": ("Não Repassado", "Repassado", "100% Executado", "Não Realinhado"),
    "situacao_realinhado": (
        "Realinhado sem Execução",
        "Realinhado/Concluído Com Recurso Próprio",
        "Realinhado e Cancelado",
    ),
    "situacao_nao_realinhado": ("Não Realinhado",),
}

CATEGORIA_POR_CHAVE: dict[str, dict[str, str]] = {
    nome: {chave(valor): valor for valor in valores} for nome, valores in VOCABULARIOS.items()
}
