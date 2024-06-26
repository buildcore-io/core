/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'overview',
    'getting-started',
    {
      type: 'category',
      label: 'How To',
      collapsible: true,
      collapsed: false,
      items: [
        'how-to/introduction',
        {
          Projects: ['how-to/project/create-project'],
        },
        {
          Auctions: [
            'how-to/auction/create',
            'how-to/auction/bid',
            'how-to/auction/get-by-id',
            'how-to/auction/get',
          ],
        },
        {
          'DAO Management': [
            {
              type: 'category',
              label: 'Member',
              link: { type: 'doc', id: 'how-to/dao-management/member/overview' },
              items: [
                'how-to/dao-management/member/create-member',
                'how-to/dao-management/member/update-member',
                'how-to/dao-management/member/validate-address',
                'how-to/dao-management/member/get-member',
              ],
            },
            {
              type: 'category',
              label: 'Space',
              link: { type: 'doc', id: 'how-to/dao-management/space/overview' },
              items: [
                'how-to/dao-management/space/create-space',
                'how-to/dao-management/space/update-space',
                'how-to/dao-management/space/validate-address',
              ],
            },
          ],
        },
        {
          NFTs: [
            'how-to/nft/create-collection',
            'how-to/nft/purchase',
            'how-to/nft/bulk-purchase',
            'how-to/nft/create-metadata',
            'how-to/nft/transfer',
          ],
        },
        {
          Swaps: ['how-to/swap/create-swap'],
        },
        {
          Stamping: ['how-to/stamp/create-stamp'],
        },
        {
          Tokens: [
            'how-to/token/overview',
            {
              type: 'category',
              label: 'Creation and Managment',
              link: {
                type: 'generated-index',
                title: 'Token Creation and Managment',
                description: 'List of token creation and managment how-to.',
                slug: '/how-to/token/creation-managment',
              },
              items: [
                'how-to/token/creation-managment/create-token',
                'how-to/token/creation-managment/mint-token',
                'how-to/token/creation-managment/cancel-public-sale',
                'how-to/token/creation-managment/enable-trading',
                'how-to/token/creation-managment/import-token',
              ],
            },
            {
              type: 'category',
              label: 'Usage and Interaction',
              link: {
                type: 'generated-index',
                title: 'Token Usage and Interaction',
                description: 'List of token usage and interaction how-to.',
                slug: '/how-to/token/usage-interaction',
              },
              items: [
                'how-to/token/usage-interaction/trade-token',
                'how-to/token/usage-interaction/credit-token',
                'how-to/token/usage-interaction/claim-token',
                'how-to/token/usage-interaction/stake-token',
              ],
            },
          ],
        },
        'how-to/get',
        'how-to/track-otrs',
      ],
    },
    {
      type: 'category',
      label: 'Tutorials',
      link: {
        type: 'generated-index',
        title: 'Tutorials',
        description: 'List of tutorials for the Buildcore how-to.',
        slug: '/tutorials',
        keywords: [
          'tutorials',
          'api',
          'blockchain',
          'nft',
          'digital twin',
          'token',
          'staking',
          'trading',
          'launchpad',
          'staking',
          'reputation',
          'member',
          'project',
          'proposal',
          'stake reward',
          'token distribution',
          'dao management',
        ],
      },
      collapsible: true,
      collapsed: false,
      items: [
        {
          type: 'link',
          label: 'Digital Twin NFT',
          href: 'https://github.com/buildcore/buildcore-otr-examples/edit/master/src/examples/metadata_nft/TUTORIAL.md',
        },
        {
          type: 'link',
          label: 'Crew3 to Reputation',
          href: 'https://github.com/buildcore/buildcore-otr-examples/blob/master/src/examples/crew3toAward/TUTORIAL.md',
        },
      ],
    },
    'architecture',
    'token-governance',
    'faqs',
  ],
  apiSidebar: [
    {
      type: 'category',
      label: 'Reference API',
      collapsible: true,
      collapsed: true,
      items: [{ type: 'autogenerated', dirName: 'reference-api' }],
    },
  ],
};

module.exports = sidebars;
