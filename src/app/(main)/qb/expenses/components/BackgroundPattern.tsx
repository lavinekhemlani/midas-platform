export function BackgroundPattern() {
  return (
    <div className="absolute inset-0 opacity-5">
      <svg className="absolute bottom-0 right-0 w-32 h-32" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="0.8" />
      </svg>
    </div>
  )
}
