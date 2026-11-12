/** Fundo institucional do GIO (login) — gradiente azul profundo, grid técnico e elementos decorativos. */
export function FundoGio() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(135deg,#041D33_0%,#083B66_50%,#075F9A_100%)]"
    >
      {/* Grid técnico */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.04]" />

      {/* Overlay radial com a mesma paleta do cabeçalho GIO */}
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(circle_at_10%_20%,#0f172a_0%,transparent_45%),radial-gradient(circle_at_90%_80%,#1e3a8a_0%,transparent_45%),radial-gradient(circle_at_100%_100%,#2563eb_0%,transparent_50%)] opacity-30" />

      {/* Linha decorativa circular */}
      <div className="absolute left-[-100px] top-[-200px] z-[1] h-[600px] w-[600px] rounded-full border border-dashed border-white/10" />

      {/* Linha decorativa rotacionada */}
      <div className="absolute bottom-[-100px] right-[5%] z-[1] h-[400px] w-[400px] rotate-45 border border-dashed border-white/10" />
    </div>
  )
}
