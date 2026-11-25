import type { Config } from 'tailwindcss';

// Tokens come from DESIGN.md (v2). Don't add colours or type styles that aren't there.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF', // only for text and icons on --accent
      bg: 'var(--bg)',
      surface: 'var(--surface)',
      label: 'var(--label)',
      secondary: 'var(--secondary)',
      fill: 'var(--fill)',
      hairline: 'var(--hairline)',
      accent: { DEFAULT: 'var(--accent)', text: 'var(--accent-text)' },
      'on-label': 'var(--on-label)',
      focus: 'var(--focus)',

      // TEMPORARY v1 aliases (plan task 40 removes them). They map old names onto
      // v2 values so un-migrated screens keep rendering: status is monochrome now.
      ink: { DEFAULT: 'var(--label)', muted: 'var(--secondary)' },
      line: 'var(--hairline)',
      live: { DEFAULT: 'var(--accent)', soft: 'var(--fill)' },
      winning: { DEFAULT: 'var(--label)', soft: 'var(--fill)' },
      outbid: { DEFAULT: 'var(--label)', soft: 'var(--fill)' },
      ended: 'var(--secondary)',
    },
    fontFamily: {
      sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      // TEMPORARY v1 aliases: one family now.
      display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      num: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'var(--font-inter)', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      // Type roles (DESIGN.md › Typography)
      'large-title': ['56px', { lineHeight: '60px', fontWeight: '700', letterSpacing: '-0.025em' }],
      'large-title-sm': ['34px', { lineHeight: '40px', fontWeight: '700', letterSpacing: '-0.025em' }],
      title: ['28px', { lineHeight: '34px', fontWeight: '700', letterSpacing: '-0.02em' }],
      'title-sm': ['24px', { lineHeight: '30px', fontWeight: '700', letterSpacing: '-0.02em' }],
      headline: ['17px', { lineHeight: '22px', fontWeight: '600' }],
      body: ['17px', { lineHeight: '25px' }],
      subhead: ['15px', { lineHeight: '20px' }],
      footnote: ['13px', { lineHeight: '18px' }],
      eyebrow: ['12px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.06em' }],
      // Numbers
      'price-lot': ['48px', { lineHeight: '52px', fontWeight: '700', letterSpacing: '-0.02em' }],
      'price-lot-sm': ['40px', { lineHeight: '44px', fontWeight: '700', letterSpacing: '-0.02em' }],
      'timer-hero': ['56px', { lineHeight: '60px', fontWeight: '700', letterSpacing: '-0.02em' }],
      'price-card': ['20px', { lineHeight: '24px', fontWeight: '700' }],
      code: ['40px', { lineHeight: '44px', fontWeight: '700', letterSpacing: '0.3em' }],

      // TEMPORARY v1 aliases.
      display: ['28px', { lineHeight: '34px', fontWeight: '700', letterSpacing: '-0.02em' }],
      heading: ['20px', { lineHeight: '26px', fontWeight: '600' }],
      countdown: ['32px', { lineHeight: '36px', fontWeight: '700' }],
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
      5: '20px',
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
      borderRadius: {
        thumb: '14px',
        control: '16px',
        group: '20px',
        card: '24px',
        dock: '28px',
        pill: '999px',
        sheet: '28px', // TEMPORARY v1 alias
      },
      boxShadow: { float: 'var(--float-shadow)', elev: 'var(--float-shadow)' /* TEMPORARY v1 alias */ },
      maxWidth: { content: '1136px', lot: '560px', grid: '1136px' },
      transitionTimingFunction: { spring: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
    },
  },
  plugins: [],
};

export default config;
