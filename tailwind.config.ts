import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        warm: {
          50: 'oklch(0.98 0.01 60)',
          100: 'oklch(0.95 0.02 60)',
          200: 'oklch(0.90 0.03 60)',
          300: 'oklch(0.85 0.05 60)',
          400: 'oklch(0.70 0.08 60)',
          500: 'oklch(0.55 0.10 60)',
          600: 'oklch(0.45 0.10 60)',
          700: 'oklch(0.35 0.08 60)',
          800: 'oklch(0.25 0.05 60)',
          900: 'oklch(0.15 0.03 60)',
        },
        accent: {
          success: 'oklch(0.65 0.15 140)',
          warning: 'oklch(0.75 0.15 85)',
          error: 'oklch(0.60 0.20 25)',
          info: 'oklch(0.65 0.12 230)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
