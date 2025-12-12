import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-poppins)', 'sans-serif'],
        display: ['var(--font-poppins)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config

