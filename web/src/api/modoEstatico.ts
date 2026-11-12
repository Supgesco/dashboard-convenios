import type { Parametros } from './cliente'

interface BaseEstatica {
  resumos: Record<string, Record<string, unknown>>
  series: Record<string, Record<string, unknown>>
  municipios: Record<string, Record<string, unknown>[]>
  convenios: Record<string, Record<string, unknown>[]>
  prestacao_contas: Record<string, unknown>[]
  tomada_contas: Record<string, unknown>[]
  status_carga: Record<string, unknown> | null
  execucoes: Record<string, unknown>
}

let cacheBase: BaseEstatica | null = null

export function emModoEstatico(): boolean {
  if (import.meta.env.MODE === 'test') return false
  if (import.meta.env.VITE_MODO_ESTATICO === 'true') return true
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h.endsWith('github.io') || h.endsWith('vercel.app') || h.endsWith('netlify.app') || h.endsWith('pages.dev')) {
      return true
    }
  }
  return false
}

async function carregarBase(): Promise<BaseEstatica> {
  if (cacheBase) return cacheBase
  const baseUrl = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  const resp = await fetch(`${baseUrl}/dados-painel.json`)
  cacheBase = (await resp.json()) as BaseEstatica
  return cacheBase
}

function ordenarLista(itens: Record<string, unknown>[], ordem: string | null | undefined): Record<string, unknown>[] {
  if (!ordem) return itens
  const desc = ordem.startsWith('-')
  const campo = desc ? ordem.slice(1) : ordem
  return [...itens].sort((a, b) => {
    const va = a[campo]
    const vb = b[campo]
    if (va === vb) return 0
    if (va === null || va === undefined) return 1
    if (vb === null || vb === undefined) return -1
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
    return desc ? -cmp : cmp
  })
}

function listaMunicipiosParam(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String).filter(Boolean)
  return [String(val)].filter(Boolean)
}

export async function atenderEstatico<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  caminho: string,
  parametros: Parametros = {},
  body?: unknown,
): Promise<T> {
  const db = await carregarBase()
  const recorte = String(parametros.recorte ?? '342')
  const muns = listaMunicipiosParam(parametros.municipio)
  const pagina = Number(parametros.pagina ?? 1)
  const tamanho = Number(parametros.tamanho ?? 20)
  const ordem = parametros.ordem ? String(parametros.ordem) : null

  if (metodo === 'GET' && caminho === '/painel/resumo') {
    const baseResumo = db.resumos[recorte] ?? db.resumos['342']
    if (!muns.length) return baseResumo as T
    const convs = (db.convenios[recorte] ?? []).filter((c) => muns.includes(String(c.municipio)))
    return {
      ...baseResumo,
      municipios: muns,
      convenios: convs.length,
    } as T
  }

  if (metodo === 'GET' && caminho === '/painel/serie') {
    return (db.series[recorte] ?? db.series['342']) as T
  }

  if (metodo === 'GET' && caminho === '/painel/municipios') {
    let itens = db.municipios[recorte] ?? []
    if (muns.length) itens = itens.filter((i) => muns.includes(String(i.municipio)))
    itens = ordenarLista(itens, ordem ?? '-a_pagar')
    const inicio = (pagina - 1) * tamanho
    return {
      recorte,
      ano: 2026,
      mes: 3,
      municipios: muns,
      pagina,
      tamanho,
      total: itens.length,
      itens: itens.slice(inicio, inicio + tamanho),
    } as T
  }

  if (metodo === 'GET' && caminho === '/painel/convenios') {
    let itens = db.convenios[recorte] ?? []
    if (muns.length) itens = itens.filter((i) => muns.includes(String(i.municipio)))
    itens = ordenarLista(itens, ordem ?? '-a_pagar')
    const inicio = (pagina - 1) * tamanho
    return {
      recorte,
      ano: 2026,
      mes: 3,
      municipios: muns,
      pagina,
      tamanho,
      total: itens.length,
      itens: itens.slice(inicio, inicio + tamanho),
    } as T
  }

  if (metodo === 'GET' && caminho === '/painel/convenio') {
    const num = String(parametros.numero ?? '')
    const mun = String(parametros.municipio ?? '')
    const todos = [...(db.convenios['31'] ?? []), ...(db.convenios['89'] ?? []), ...(db.convenios['342'] ?? [])]
    const conv = todos.find((c) => String(c.numero_convenio) === num && String(c.municipio) === mun) ?? todos[0]
    return {
      ...conv,
      processo_celebracao: conv?.processo_celebracao ?? null,
      compartilhado_com: [],
      referencia: { ano: 2026, mes: 3 },
      saldos: {
        a_pagar: conv?.a_pagar ?? 0,
        a_comprovar: conv?.a_comprovar ?? 0,
        a_aprovar: conv?.a_aprovar ?? 0,
        aprovados: conv?.aprovados ?? 0,
      },
      mes_anterior: null,
      contratual: {
        valor_total: conv?.valor_total ?? null,
        repasse_estado: conv?.repasse_estado ?? null,
        contrapartida: conv?.contrapartida ?? null,
        investido_estado: conv?.investido_estado ?? null,
        a_repassar: conv?.a_repassar ?? null,
        execucao_pct: conv?.execucao_pct ?? null,
        investido_sobre_total_pct: conv?.investido_sobre_total_pct ?? null,
      },
      serie: ((db.series['342'] as { pontos?: unknown[] })?.pontos ?? []),
      tomada_contas: db.tomada_contas.filter((t) => String(t.numero_convenio) === num),
      prestacao_contas: db.prestacao_contas.filter((p) => String(p.numero_convenio) === num),
    } as T
  }

  if (metodo === 'GET' && caminho === '/painel/prestacao-contas') {
    let itens = db.prestacao_contas
    if (muns.length) itens = itens.filter((i) => muns.includes(String(i.municipio)))
    itens = ordenarLista(itens, ordem)
    const inicio = (pagina - 1) * tamanho
    return {
      municipios: muns,
      pagina,
      tamanho,
      total: itens.length,
      itens: itens.slice(inicio, inicio + tamanho),
    } as T
  }

  if (metodo === 'GET' && caminho === '/painel/tomada-contas') {
    let itens = db.tomada_contas
    if (muns.length) itens = itens.filter((i) => muns.includes(String(i.municipio)))
    itens = ordenarLista(itens, ordem)
    const inicio = (pagina - 1) * tamanho
    return {
      municipios: muns,
      pagina,
      tamanho,
      total: itens.length,
      itens: itens.slice(inicio, inicio + tamanho),
    } as T
  }

  if (metodo === 'GET' && caminho === '/etl/siafe/status') {
    return db.status_carga as T
  }

  if (metodo === 'GET' && caminho === '/etl/siafe/execucoes') {
    return db.execucoes as T
  }

  if (metodo === 'POST' && caminho === '/painel/convenios') {
    const p = (body ?? {}) as Record<string, unknown>
    const novo: Record<string, unknown> = {
      numero_convenio: String(p.numero_convenio ?? '').trim(),
      municipio: String(p.municipio ?? '').trim(),
      codigo_seobras: p.codigo_seobras ?? null,
      codigo_seiop: p.codigo_seiop ?? null,
      codigo_compartilhado: false,
      status: p.status ?? 'Em execução',
      fase: p.fase ?? null,
      situacao_vigencia: p.situacao_vigencia ?? 'Vigente',
      a_pagar: Number(p.a_pagar ?? 0),
      a_comprovar: Number(p.a_comprovar ?? 0),
      a_aprovar: Number(p.a_aprovar ?? 0),
      aprovados: Number(p.aprovados ?? 0),
      valor_total: Number(p.valor_total ?? 0),
      repasse_estado: Number(p.repasse_estado ?? 0),
      contrapartida: Number(p.contrapartida ?? 0),
      investido_estado: Number(p.investido_estado ?? 0),
      a_repassar: Number(p.a_repassar ?? 0),
      execucao_pct: 0,
      investido_sobre_total_pct: 0,
    }
    const recs = Array.isArray(p.recortes) ? p.recortes.map(String) : ['31', '89', '342']
    for (const r of recs) {
      db.convenios[r] = [novo, ...(db.convenios[r] ?? [])]
      if (db.resumos[r]) {
        db.resumos[r].convenios = Number(db.resumos[r].convenios ?? 0) + 1
      }
    }
    return novo as T
  }

  if (metodo === 'PUT' && caminho === '/painel/convenios') {
    const p = (body ?? {}) as Record<string, unknown>
    let atualizado: Record<string, unknown> = p
    for (const r of ['31', '89', '342']) {
      db.convenios[r] = (db.convenios[r] ?? []).map((c) => {
        if (c.numero_convenio === p.numero_convenio && c.municipio === p.municipio) {
          atualizado = { ...c, ...p }
          return atualizado
        }
        return c
      })
    }
    return atualizado as T
  }

  if (metodo === 'DELETE' && caminho === '/painel/convenios') {
    const num = String(parametros.numero ?? '')
    const mun = String(parametros.municipio ?? '')
    const prestId = parametros.prestacao_id ? Number(parametros.prestacao_id) : null
    const tomId = parametros.tomada_id ? Number(parametros.tomada_id) : null
    if (num) {
      for (const r of ['31', '89', '342']) {
        const antes = (db.convenios[r] ?? []).length
        db.convenios[r] = (db.convenios[r] ?? []).filter(
          (c) => !(String(c.numero_convenio) === num && (!mun || String(c.municipio) === mun)),
        )
        const depois = db.convenios[r].length
        if (depois < antes && db.resumos[r]) {
          db.resumos[r].convenios = Math.max(0, Number(db.resumos[r].convenios ?? 0) - (antes - depois))
        }
      }
    }
    db.prestacao_contas = db.prestacao_contas.filter(
      (p) =>
        !(
          (prestId !== null && Number(p.id) === prestId) ||
          (Boolean(num) && String(p.numero_convenio) === num && (!mun || String(p.municipio) === mun))
        ),
    )
    db.tomada_contas = db.tomada_contas.filter(
      (t) =>
        !(
          (tomId !== null && Number(t.id) === tomId) ||
          (Boolean(num) && String(t.numero_convenio) === num && (!mun || String(t.municipio) === mun))
        ),
    )
    return { ok: true } as T
  }

  return ({ ok: true, ...(typeof body === 'object' && body ? body : {}) } as unknown) as T
}
