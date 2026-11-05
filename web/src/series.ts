// Paleta das séries, em ordem fixa (azul dominante, acento quente, azul claro vizinho, verde-azulado).
// validate_palette.js --mode light --surface #ffffff (superfície do cartão):
//   adjacentes: lightness, chroma, CVD (pior ΔE 15,2 deutan) e visão normal (16,4) PASS;
//   --pairs all (linhas podem se cruzar): CVD pior ΔE 9,7 (protan), visão normal 16,4 PASS;
//   contraste: WARN em #4fa8e0 (2,62:1) → legenda sempre visível, "Ver tabela" e tooltip; textos nunca na cor da série.
export const SERIES = [
  { campo: 'a_pagar', rotulo: 'A pagar', cor: '#1d5fc4' },
  { campo: 'a_comprovar', rotulo: 'A comprovar', cor: '#d9772b' },
  { campo: 'a_aprovar', rotulo: 'A aprovar', cor: '#4fa8e0' },
  { campo: 'aprovados', rotulo: 'Aprovados', cor: '#1c8f7a' },
] as const

export type CampoSerie = (typeof SERIES)[number]['campo']

/** Cor de cada série, para a marca de identidade nos cards de saldo. */
export const COR_SERIE = Object.fromEntries(SERIES.map((s) => [s.campo, s.cor])) as Record<CampoSerie, string>
