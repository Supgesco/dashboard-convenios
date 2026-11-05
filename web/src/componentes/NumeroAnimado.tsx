import { animate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { AUSENTE } from '../formato'
import { ANIMAR } from '../movimento'

interface Props {
  valor: number | null | undefined
  formatar: (v: number) => string
  /** Duração da contagem, em segundos. */
  duracao?: number
}

/** Arredonda o passo intermediário na mesma precisão do alvo (inteiro fica inteiro, moeda em centavos). */
function passo(v: number, alvo: number): number {
  return Number.isInteger(alvo) ? Math.round(v) : Math.round(v * 100) / 100
}

/**
 * Número que conta até o valor (do zero na primeira vez, do valor anterior quando o dado muda).
 * Nulo mostra "—" na hora; nos testes (`ANIMAR` falso) o valor final aparece direto.
 */
export function NumeroAnimado({ valor, formatar, duracao = 0.8 }: Props) {
  const alvo = valor ?? null
  const estatico = alvo === null || !ANIMAR
  const [exibido, setExibido] = useState(0)
  const anterior = useRef(0)

  useEffect(() => {
    if (alvo === null) return
    if (!ANIMAR) {
      anterior.current = alvo
      return
    }
    const controles = animate(anterior.current, alvo, {
      duration: duracao,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setExibido(passo(v, alvo)),
      onComplete: () => setExibido(alvo),
    })
    anterior.current = alvo
    return () => controles.stop()
  }, [alvo, duracao])

  const mostrar = estatico ? alvo : exibido
  return <span className="tabular-nums">{mostrar === null ? AUSENTE : formatar(mostrar)}</span>
}
