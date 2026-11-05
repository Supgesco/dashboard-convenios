// O painel anima sempre, mesmo com "reduzir movimento" ligado no sistema (decisão do usuário: muitas
// máquinas da rede vêm com os efeitos de animação do Windows desligados). Só nos testes nada anima,
// para que vejam direto o estado final (contadores no valor exato).
export const ANIMAR = import.meta.env.MODE !== 'test'
