// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'BUILD.5',
  tagline: 'BUILD.5 Documentation',
  favicon: 'img/favicon.ico',
  // Set the production url of your site here
  url: 'https://developer.build5.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',
  onBrokenLinks: 'warn',
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
        cleanOutputDir: true,
      },
    ],
    [
      'docusaurus-plugin-typedoc',
      {
        id: 'api-get',
        sidebar: {
          categoryLabel: 'GET Requests',
        },
        entryPoints: [
          '../packages/interfaces/src/api/base.ts',
          '../packages/interfaces/src/api/request.ts',
        ],
        tsconfig: '../packages/interfaces/tsconfig.json',
        out: 'api-get',
        cleanOutputDir: true,
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
        cleanOutputDir: true,
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
          '../packages/interfaces/src/models/transactions/index.ts',
          '../packages/interfaces/src/config.ts',
          '../packages/interfaces/src/errors.ts',
        ],
        tsconfig: '../packages/interfaces/tsconfig.json',
        out: 'api-models',
        cleanOutputDir: true,
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
        docs: { sidebarPath: require.resolve('./sidebars.js') },
        blog: false,
        pages: {
          path: 'src/pages',
        },
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
          alt: 'Build5 Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            type: 'docSidebar',
            sidebarId: 'apiSidebar',
            position: 'left',
            label: 'APIs',
          },
          {
            href: 'https://build5.com/blog',
            label: 'Blog',
            position: 'left',
          },
          {
            href: 'https://github.com/build-5',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/x7sBB2SZCg',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/build5tech',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: 'https://build5.com/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/build-5',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} BUILD.5. All Rights Reserved.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
