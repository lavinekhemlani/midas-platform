export function BackgroundPattern() {
  return (
    <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
      {/* Subtle grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
    </div>
  )
}
