module.exports = {
  prefix: '',
  purge: {
    enabled: process.env.TAILWIND_MODE === 'build',
    content: ['./src/**/*.{html,ts}', './projects/**/*.{html,ts}'],
  },
  darkMode: 'class',
  theme: {
    fontFamily: {
      display: ['Poppins', 'sans-serif'],
      body: ['Poppins', 'sans-serif'],
    },
    container: {
      center: true,
      padding: '1.5rem',
    },
    extend: {
      color: {
        inherit: 'inherit',
      },
      spacing: {
        75: '18.75rem',
      },
      maxWidth: {
        fit: 'fit-content',
      },
    },
  },
  variants: {},
  plugins: [],
};
