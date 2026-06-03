/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#00D9FF',
          blue: '#0066FF',
          orange: '#FF6B35',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'Roboto', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #00D9FF 0%, #0066FF 100%)',
      },
    },
  },
  plugins: [],
}
