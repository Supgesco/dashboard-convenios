// Gera src/mapa/municipios-rj.json: contornos dos 92 municípios do RJ (malha pública do IBGE), com o nome oficial.
// Rode à mão (precisa de internet) só quando quiser atualizar a malha: `npm run mapa:malha`.
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const IBGE = 'https://servicodados.ibge.gov.br/api'
const MALHA = `${IBGE}/v3/malhas/estados/33?intrarregiao=municipio&qualidade=intermediaria&formato=application/vnd.geo%2Bjson`
const NOMES = `${IBGE}/v1/localidades/estados/33/municipios`
const TOTAL = 92
const CASAS = 4

const destino = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src/mapa/municipios-rj.json')

async function json(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.json()
}

const arredondar = (c) =>
  typeof c[0] === 'number' ? c.map((n) => Math.round(n * 10 ** CASAS) / 10 ** CASAS) : c.map(arredondar)

const [malha, nomes] = await Promise.all([json(MALHA), json(NOMES)])
const nomePorCodigo = new Map(nomes.map((m) => [String(m.id), m.nome]))

const features = malha.features.map((f) => {
  const codigo = String(f.properties.codarea)
  const nome = nomePorCodigo.get(codigo)
  if (!nome) throw new Error(`Código IBGE ${codigo} sem nome na lista de municípios`)
  return {
    type: 'Feature',
    properties: { codigo_ibge: codigo, nome },
    geometry: { type: f.geometry.type, coordinates: arredondar(f.geometry.coordinates) },
  }
})
features.sort((a, b) => a.properties.nome.localeCompare(b.properties.nome, 'pt-BR'))

if (features.length !== TOTAL || new Set(features.map((f) => f.properties.codigo_ibge)).size !== TOTAL) {
  throw new Error(`Esperados ${TOTAL} municípios distintos, vieram ${features.length}`)
}

const texto = JSON.stringify({ type: 'FeatureCollection', features })
writeFileSync(destino, texto + '\n', 'utf-8')
console.log(`${features.length} municípios gravados em src/mapa/municipios-rj.json (${Math.round(texto.length / 1024)} KB)`)
