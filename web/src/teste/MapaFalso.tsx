// Dublê do mapa Leaflet para o jsdom: um botão por município da malha, com a cor e o estado que o mapa daria.
// A lógica (junção, cores, dica, clique só com convênio) é a real; só o desenho do Leaflet fica de fora.
import { chave, corDe, juntar, textoDica } from '../mapa/logica'
import type { PropsMapa } from '../mapa/MapaMunicipios'
import malha from '../mapa/municipios-rj.json'

export default function MapaFalso({ linhas, faixas, selecionados, onMunicipio }: PropsMapa) {
  const contagens = juntar(malha.features, linhas)
  return (
    <ul aria-label="Mapa (dublê)">
      {malha.features.map(({ properties: { nome } }) => {
        const k = chave(nome)
        const q = contagens.get(k) ?? 0
        return (
          <li key={nome}>
            <button
              type="button"
              aria-label={textoDica(nome, q)}
              data-cor={corDe(q, faixas)}
              data-apagado={selecionados.size > 0 && !selecionados.has(k)}
              onClick={() => q > 0 && onMunicipio(nome)}
            />
          </li>
        )
      })}
    </ul>
  )
}
