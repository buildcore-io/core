const fs = require('fs');
const lessToJs = require('less-vars-to-js');
const { kebabCase, mapKeys } = require('lodash');

const lightThemeLess = fs.readFileSync('src/theme/light.less').toString();
const lightTheme = lessToJs(lightThemeLess, {
  resolveVariables: true,
  stripPrefix: true,
});

const normalizeNames = (theme) => mapKeys(theme, (_, name) => kebabCase(name));

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
        // Modern definition - shared with less variables used in ng-zorro
        ...normalizeNames(lightTheme),

        // Obsolete definition - will be removed once we migrate all
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
          success: '#8FE46C',
        },
        'app-gray': {
          text: '#333333',
          100: '#E4E1D2',
          200: '#CAC8BD',
          400: '#9F9D93',
          500: '#D9D8D0',
          600: '#999999',
          700: '#E6E6E6',
          separator: {
            light: '#F5F4EF',
            dark: '#C4C4C4'
          }
        },
        tag: {
          blue: '#DCEFF9',
          green: '#DEF7D4',
          red: '#F9DED2',
          orange: '#FFC670',
          default: '#F6F5F0',
          black: '#333333',
        },
        bg: {
          white: '#FFFFFF',
          background: '#F6F5F0',
          footer: '#ECE8DE',
        },
        alerts: {
          error: '#D94B08',
          warning: '#FAE312'
        },
        foregrounds: {
          secondary: '#959388',
          separator: '#F0EEE6',
          tertiary: '#BCB9A9'
        },
        red: {
          primary: '#FF0019'
        },
        brown: {
          primary: '#A66300',
          secondary: '#F4F2E4',
          light: '#C6BF9F'
        },
        pink: '#F20CDF',
        black: '#000000',
        yellow: {
          primary: '#FFEF64',
          secondary: '#FFE815'
        }

      },
      spacing: {
        18: '4.5rem',
        75: '18.75rem',
      },
      minWidth: {
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        32: '8rem',
        40: '10rem',
        60: '15rem',
        76: '19rem',
        100: '25rem',
        120: '30rem',
      },
      maxWidth: {
        fit: 'fit-content',
        20: '5rem',
        24: '6rem',
        40: '10rem',
        80: '20rem',
        128: '32rem',
        160: '40rem',
        '1/2': '50%',
        '1/3': '33%',
        '2/3': '66%',
        450: '450px'
      },
      width: {
        header: '500px',
        76: '19rem',
        '3/10': '30%'
      },
      minHeight: {
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        24: '6rem',
        76: '19rem',
        180: '45rem'
      },
      maxHeight: {
        56: '14rem',
        80: '20rem',
        128: '32rem',
      },
      height: {
        76: '19rem',
        99: '24.75rem'
      },
      borderRadius: {
        9: '2.25rem',
        10: '2.5rem',
        large: '3rem',
        40: '10rem',
      },
      borderWidth: {
        3: '3px',
      },
      dropShadow: {
        card: '0px 0px 12px rgba(0, 0, 0, 0.08)',
      },
      boxShadow: {
        header: '0px 2px 3px #E6E5DE',
        modal: '0px 2px 32px rgba(0, 0, 0, 0.16)'
      },
      fontSize: {
        xxs: '0.625rem'
      }
    },
  },
  variants: {},
  plugins: [require('@tailwindcss/line-clamp')],
};
