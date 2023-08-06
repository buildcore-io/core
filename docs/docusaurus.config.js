// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Build5',
  tagline: 'Build5 Documentation',
  favicon: 'img/favicon.ico',
  // Set the production url of your site here
  url: 'https://developer.build5.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'api-post',
        sidebar: {
          categoryLabel: 'POST Requests',
        },
        entryPoints: ['../packages/interfaces/src/api/post/index.ts'],
        tsconfig: '../packages/interfaces/tsconfig.json',
        out: 'api-post',
      },
    ],
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'api-get',
        sidebar: {
          categoryLabel: 'GET Requests',
        },
        entryPoints: ['../packages/interfaces/src/api/request.ts'],
        tsconfig: '../packages/interfaces/tsconfig.json',
        out: 'api-get',
      },
    ],
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'api-otr',
        sidebar: {
          categoryLabel: 'OTR Requests',
        },
        entryPoints: ['../packages/interfaces/src/api/tangle/index.ts'],
        tsconfig: '../packages/interfaces/tsconfig.json',
        out: 'api-otr',
      },
    ],
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'api-models',
        sidebar: {
          categoryLabel: 'Records / Models',
        },
        entryPoints: [
          '../packages/interfaces/src/models/index.ts',
          '../packages/interfaces/src/config.ts',
          '../packages/interfaces/src/errors.ts',
        ],
        tsconfig: '../packages/interfaces/tsconfig.json',
        out: 'api-models',
      },
    ],
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: { routeBasePath: '/', sidebarPath: require.resolve('./sidebars.js') },
        blog: false,
        // TODO Enable pages.
        // pages: {
        //   path: 'src/pages',
        //   routeBasePath: '/',
        //   include: ['**/*.{md,mdx}'],
        //   exclude: [
        //     '**/_*.{js,jsx,ts,tsx,md,mdx}',
        //     '**/_*/**',
        //     '**/*.test.{js,jsx,ts,tsx}',
        //     '**/__tests__/**',
        //   ],
        //   mdxPageComponent: '@theme/MDXPage',
        // },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: 'Build5',
        logo: {
          alt: 'My Site Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
        ],
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
