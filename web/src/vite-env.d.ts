/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base das chamadas à API. Padrão: /api (o proxy do Vite). */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
