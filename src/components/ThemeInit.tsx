'use client'

export default function ThemeInit() {
  return (
    <>
      {/* 1) Prevent flash by hiding until data-theme is set */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html:not([data-theme]) { visibility: hidden; }
            html[data-theme] { visibility: visible; }
            :root { --zenith-transition: 1.5s ease-in-out; }
            .theme-light { --theme-bg: #f1f5f9; }
            .theme-dark { --theme-bg: #000000; }
          `,
        }}
      />

      {/* 2) Immediately set the theme from localStorage or OS preference */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                if (document.documentElement.hasAttribute('data-theme-init')) return;
                var t = localStorage.getItem('zenith-theme') || 'light';
                document.documentElement.classList.remove('theme-light','theme-dark');
                document.documentElement.classList.add('theme-' + t);
                document.documentElement.setAttribute('data-theme', t);
                document.documentElement.setAttribute('data-theme-init', 'true');
              } catch (e) {
                document.documentElement.classList.add('theme-light');
                document.documentElement.setAttribute('data-theme', 'light');
                document.documentElement.setAttribute('data-theme-init', 'true');
              }
            })();
          `,
        }}
      />
    </>
  )
}
