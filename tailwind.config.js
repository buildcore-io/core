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
        orange: {
          lightest: '#F2C50C',
          light: '#FFA319',
          dark: '#F39200',
          DEFAULT: '#F39200',
          darkest: '#F2550C',
        },
        blue: {
          light1: '#008AF2',
          light2: '#1895F2',
          medium: '#005FA6',
          DEFAULT: '#005FA6',
          dark1: '#0C16F2',
          dark2: '#1822F2',
          darkest: '#1117A6',
        },
        green: {
          dark: '#11A696',
          neon: '#58F218',
        },
        brown: '#A66300',
        pink: '#F20CDF',
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
