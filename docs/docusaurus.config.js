// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion
import codeImport from 'remark-code-import';

const path = require('path');
const {themes} = require('prism-react-renderer');
const lightTheme = themes.github;
const darkTheme = themes.dracula;

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
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',
  plugins: [
    [
      // FUll help: https://typedoc.org/options/configuration/
      'docusaurus-plugin-typedoc',
      {
        id: 'reference-api',
        name: 'Reference API',
        sidebar: {
          categoryLabel: 'Reference API',
        },
        entryPoints: [
          // SDK Documentation.
          '../packages/sdk/doc.ts',

          // Interfaces.
          '../packages/interfaces/doc.ts',
        ],
        readme: '../packages/interfaces/README.md',
        tsconfig: './tsconfig.api-doc.json',
        out: 'reference-api',
        watch: process.env.TYPEDOC_WATCH,
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
        docs: { 
          sidebarPath: require.resolve('./sidebars.js'),
          remarkPlugins: [
            [require('@docusaurus/remark-plugin-npm2yarn'), {sync: true}],
            [codeImport, {rootDir: path.resolve('../.')}],
          ],
        },
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
  themes: ['@saucelabs/theme-github-codeblock'],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: '',
        logo: {
          alt: 'Build5 Logo',
          src: 'img/logo.svg',
          srcDark: 'img/logo_dark.svg',
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
        theme: lightTheme,
        darkTheme: darkTheme,
        additionalLanguages: ['bash'],
      },
    }),
};

module.exports = config;
