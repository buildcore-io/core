// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion
import codeImport from 'remark-code-import';

const path = require('path');
const { themes } = require('prism-react-renderer');
const lightTheme = themes.github;
const darkTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Buildcore',
  tagline: 'Buildcore Documentation',
  favicon: 'img/favicon.ico',
  // Set the production url of your site here
  url: 'https://developer.buildcore.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
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
            [require('@docusaurus/remark-plugin-npm2yarn'), { sync: true }],
            [codeImport, { rootDir: path.resolve('../.') }],
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
  markdown: {
    mermaid: true,
  },
  themes: ['@saucelabs/theme-github-codeblock', '@docusaurus/theme-mermaid'],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: '',
        logo: {
          alt: 'Buildcore logo',
          src: 'img/buildcore_logo.png',
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
            href: 'https://buildcore.io/blog',
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
                to: 'https://buildcore.io/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/build-5',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Buildcore. All Rights Reserved.`,
      },
      prism: {
        theme: lightTheme,
        darkTheme: darkTheme,
        additionalLanguages: ['bash'],
      },
    }),
};

module.exports = config;
