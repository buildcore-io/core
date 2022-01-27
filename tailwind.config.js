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
      padding: '2.5rem',
    },
    extend: {
      colors: {
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
          hover: '#24A1FF',
          pressed: '#0080E0',
          dropbg: '#EDF8FC',
        },
        green: {
          dark: '#11A696',
          neon: '#58F218',
          success: '#8FE46C'
        },
        'app-gray': {
          text: '#333333',
          100: '#E4E1D2',
          200: '#CAC8BD',
          400: '#9F9D93',
          600: '#999999',
          separator: '#F5F4EF'
        },
        tag: {
          blue: '#DCEFF9',
          green: '#DEF7D4',
          red: '#F9DED2',
          orange: '#FFC670',
          default: '#F6F5F0',
          black: '#333333'
        },
        bg: {
          white: '#FFFFFF',
          background: '#F6F5F0',
          footer: '#ECE8DE',
        },
        brown: '#A66300',
        pink: '#F20CDF',
      },
      spacing: {
        18: '4.5rem',
        75: '18.75rem',
      },
      minWidth: {
        6: '1.5rem',
        10: '2.5rem',
        32: '8rem',
        100: '25rem',
        120: '30rem'
      },
      maxWidth: {
        fit: 'fit-content',
      },
      width: {
        header: '500px',
      },
      minHeight: {
        24: '6rem',
        180: '45rem'
      },
      maxHeight: {
        56: '14rem',
        80: '20rem',
        128: '32rem'
      },
      borderRadius: {
        9: '2.25rem',
        10: '2.5rem',
        large: '3rem',
        40: '10rem'
      },
      dropShadow: {
        card: '0px 0px 12px rgba(0, 0, 0, 0.08)'
      },
      boxShadow: {
        header: '0px 2px 3px #E6E5DE'
      }
    },
  },
  variants: {},
  plugins: [],
};
