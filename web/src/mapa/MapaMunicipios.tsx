// Mapa Leaflet dos municípios do RJ. Carregado sob demanda (React.lazy) pela tela Municípios:
// o Leaflet, o CSS dele e a malha só entram nesse pedaço do pacote.
import 'leaflet/dist/leaflet.css'
import L, { type GeoJSON as CamadaGeoJSON, type Layer, type Path, type PathOptions } from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'

import type { Contagem, Faixa } from './logica'
import { chave, corDe, juntar, textoDica } from './logica'
import malha from './municipios-rj.json'

type Malha = GeoJSON.FeatureCollection<GeoJSON.Geometry, { nome: string; codigo_ibge: string }>
const MALHA = malha as Malha
const LIMITES = L.geoJSON(MALHA).getBounds()

export interface PropsMapa {
  /** Convênios por município no recorte; município da malha fora da lista conta 0. */
  linhas: readonly Contagem[]
  faixas: readonly Faixa[]
  /** Municípios do filtro (chave do nome); vazio = nenhum filtro, todos com cor cheia. */
  selecionados: ReadonlySet<string>
  onMunicipio: (nome: string) => void
}

const OPACIDADE = 0.85
const OPACIDADE_APAGADO = 0.25
const DESTAQUE: PathOptions = { color: '#1e293b', weight: 2 }

/** Enquadra o RJ depois que o contêiner tem o tamanho final; a rolagem do mouse só dá zoom com o mapa em foco. */
function Enquadrar() {
  const mapa = useMap()
  useEffect(() => {
    mapa.invalidateSize()
    mapa.fitBounds(LIMITES, { padding: [12, 12] })
    mapa.setMinZoom(mapa.getZoom() - 1)
  }, [mapa])
  useEffect(() => {
    const ligar = () => mapa.scrollWheelZoom.enable()
    const desligar = () => mapa.scrollWheelZoom.disable()
    mapa.on('focus', ligar)
    mapa.on('blur', desligar)
    return () => {
      mapa.off('focus', ligar)
      mapa.off('blur', desligar)
    }
  }, [mapa])
  return null
}

export default function MapaMunicipios({ linhas, faixas, selecionados, onMunicipio }: PropsMapa) {
  const camada = useRef<CamadaGeoJSON | null>(null)
  const contagens = useMemo(() => juntar(MALHA.features, linhas), [linhas])
  // Os eventos são ligados uma vez por feição; leem sempre os dados atuais por esta ref.
  const atual = useRef({ contagens, onMunicipio })
  useEffect(() => {
    atual.current = { contagens, onMunicipio }
  })

  const qtd = (nome: string) => atual.current.contagens.get(chave(nome)) ?? 0

  const estilo = (f?: GeoJSON.Feature): PathOptions => {
    const nome = (f?.properties as { nome: string } | undefined)?.nome ?? ''
    const k = chave(nome)
    const apagado = selecionados.size > 0 && !selecionados.has(k)
    return {
      color: '#ffffff',
      weight: 1,
      fillColor: corDe(contagens.get(k) ?? 0, faixas),
      fillOpacity: apagado ? OPACIDADE_APAGADO : OPACIDADE,
    }
  }

  // Recolore ao trocar o recorte ou o filtro (o GeoJSON do react-leaflet não reaplica o estilo sozinho).
  useEffect(() => {
    camada.current?.setStyle(estilo)
  })

  const porFeicao = (f: GeoJSON.Feature, layer: Layer) => {
    const nome = (f.properties as { nome: string }).nome
    layer.bindTooltip(() => textoDica(nome, qtd(nome)), { sticky: true, direction: 'top', className: 'dica-mapa' })
    layer.on({
      mouseover: (e) => {
        const alvo = e.target as Path
        alvo.setStyle(DESTAQUE)
        alvo.bringToFront()
        const el = (alvo as Path & { getElement?: () => Element | undefined }).getElement?.() as SVGElement | undefined
        if (el) el.style.cursor = qtd(nome) > 0 ? 'pointer' : 'default'
      },
      mouseout: (e) => camada.current?.resetStyle(e.target as Path),
      click: () => {
        if (qtd(nome) > 0) atual.current.onMunicipio(nome)
      },
    })
  }

  return (
    <MapContainer
      bounds={LIMITES}
      maxBounds={LIMITES.pad(0.25)}
      maxBoundsViscosity={1}
      zoomSnap={0.25}
      scrollWheelZoom={false}
      className="mapa-municipios h-[420px] w-full rounded-xl"
    >
      <Enquadrar />
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        className="mapa-fundo"
        maxZoom={19}
      />
      <GeoJSON ref={camada} data={MALHA} style={estilo} onEachFeature={porFeicao} />
    </MapContainer>
  )
}
