import type { Config } from 'tailwindcss';

// Tokens come from DESIGN.md. Don't add colors or type styles that aren't there.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF', // only for text on --ink and --live (16px semibold or larger on --live)
      bg: 'var(--bg)',
      surface: 'var(--surface)',
      ink: { DEFAULT: 'var(--ink)', muted: 'var(--ink-muted)' },
      line: 'var(--line)',
      live: { DEFAULT: 'var(--live)', soft: 'var(--live-soft)' },
      winning: { DEFAULT: 'var(--winning)', soft: 'var(--winning-soft)' },
      outbid: { DEFAULT: 'var(--outbid)', soft: 'var(--outbid-soft)' },
      ended: 'var(--ended)',
      focus: 'var(--focus)',
    },
    fontFamily: {
      display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      num: ['var(--font-num)', 'var(--font-body)', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      // Type roles
      display: ['28px', { lineHeight: '32px', fontWeight: '700' }],
      heading: ['20px', { lineHeight: '26px', fontWeight: '600' }],
      body: ['15px', { lineHeight: '22px' }],
      label: ['12px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.06em' }],
      // Number sizes
      'price-lot': ['40px', { lineHeight: '44px', fontWeight: '600' }],
      countdown: ['32px', { lineHeight: '36px', fontWeight: '600' }],
      'price-card': ['20px', { lineHeight: '24px', fontWeight: '600' }],
      code: ['40px', { lineHeight: '44px', fontWeight: '600', letterSpacing: '0.3em' }],
    },
    spacing: {
      0: '0',
      px: '1px',
      0.5: '2px',
      1: '4px',
      1.5: '6px',
      2: '8px',
      3: '12px',
      4: '16px',
      6: '24px',
      8: '32px',
      11: '44px',
      12: '48px',
      14: '56px',
      16: '64px',
      20: '80px',
      24: '96px',
      28: '112px',
    },
    extend: {
      borderRadius: { card: '12px', sheet: '16px', pill: '999px' },
      boxShadow: { elev: 'var(--shadow)' },
      maxWidth: { lot: '560px', grid: '1120px' },
    },
  },
  plugins: [],
};

export default config;
