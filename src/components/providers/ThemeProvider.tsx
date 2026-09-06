// src/components/providers/ThemeProvider.tsx
// Prevents theme flash and ensures smooth transitions
'use client'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Theme initialization is handled by ThemeScript injected in <head>.
  // No useEffect needed — the script runs before paint, preventing flash.
  return <>{children}</>
}

// Also create a script to inject early in <head>
export const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `
        try {
          const theme = localStorage.getItem('zenith-theme') || 'light';
          document.documentElement.classList.add('theme-' + theme);
          document.documentElement.setAttribute('data-theme', theme);
        } catch (e) {
          document.documentElement.classList.add('theme-light');
          document.documentElement.setAttribute('data-theme', 'light');
        }
      `,
    }}
  />
)
