import type { Config } from 'tailwindcss';

// Tokens come from DESIGN.md. Don't add colors or type styles that aren't there.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: 'var(--bg)',
      surface: 'var(--surface)',
      ink: 'var(--ink)',
      muted: 'var(--muted)',
      line: 'var(--line)',
      brand: { DEFAULT: 'var(--brand)', ink: 'var(--brand-ink)' },
      live: 'var(--live)',
      success: 'var(--success)',
      danger: 'var(--danger)',
      warn: 'var(--warn)',
    },
    fontFamily: {
      sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
    },
    fontSize: {
      display: ['28px', { lineHeight: '32px', fontWeight: '700' }],
      title: ['20px', { lineHeight: '26px', fontWeight: '600' }],
      body: ['16px', { lineHeight: '24px' }],
      small: ['14px', { lineHeight: '20px' }],
      micro: ['12px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.04em' }],
    },
    extend: {
      borderRadius: { card: '14px', pill: '999px' },
    },
  },
  plugins: [],
};

export default config;
