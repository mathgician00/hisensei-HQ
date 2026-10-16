import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#6dd95d',
          blue: '#65acff',
          purple: '#c1a9e6',
          coral: '#f77f73',
          amber: '#fdb01b',
          gold: '#fdce1b',
        },
        canvas: '#f8fafc',
      },
    },
  },
  plugins: [],
};
export default config;
