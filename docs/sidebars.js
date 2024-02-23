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
      link: {type: 'doc', id: 'how-to/overview'},
      collapsible: true,
      collapsed: false,
      items: [
        {
          'Projects': [
            'how-to/project/create-project',
          ],
        },
        {
          'Auction API': ['how-to/auction/create'],
        },
        {
          'DAO Management': [
            {
              type: 'category',
              label: 'Member',
              link: {type: 'doc', id: 'how-to/dao-management/member/overview'},
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
              link: {type: 'doc', id: 'how-to/dao-management/space/overview'},
              items: [
                'how-to/dao-management/space/create-space',
                'how-to/dao-management/space/update-space',
                'how-to/dao-management/space/validate-address',
              ],
            },
          ],
        },
        {
          'NFT API': [
            'how-to/nft/create-collection',
            'how-to/nft/purchase',
            'how-to/nft/bulk-purchase',
            'how-to/nft/create-metadata',
            'how-to/nft/transfer',
          ],
        },
        {
          'Stamp API': [
            'how-to/stamp/create-stamp',
          ],
        },
        {
          'NFT Trading API': ['how-to/nft-trading/overview'],
        },
        {
          'NFT Staking API': ['how-to/nft-staking/overview'],
        },
        {
          'Proposal API': ['how-to/proposal/overview'],
        },
        {
          'Reputation API': ['how-to/reputation/overview'],
        },
        {
          'Stake Reward API': ['how-to/stake-reward/overview'],
        },
        {
          'Token API': [
            'how-to/token/overview',
            'how-to/token/create-token',
            'how-to/token/trade-token',
            'how-to/token/mint-token',
          ],
        },
        {
          'Token Launchpad API': ['how-to/token-launchpad/overview'],
        },
        {
          'Token Trading API': ['how-to/token-trading/overview'],
        },
        {
          'Token Staking API': ['how-to/token-staking/overview'],
        },
        {
          'Token Distribution API': ['how-to/token-distribution/overview'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Tutorials',
      link: {
        type: 'generated-index',
        title: 'Tutorials',
        description: 'List of tutorials for the BUILD.5 how-to.',
        slug: '/tutorials',
        keywords: ['tutorials', 'api', 'blockchain', 'nft', 'digital twin', 'token', 'staking', 'trading', 'launchpad', 'staking', 'reputation', 'member', 'project', 'proposal', 'stake reward', 'token distribution', 'dao management'],
      },
      collapsible: true,
      collapsed: false,
      items: [
        {
          type: 'link',
          label: 'Digital Twin NFT',
          href: 'https://github.com/build-5/build5-otr-examples/edit/master/src/examples/metadata_nft/TUTORIAL.md',
        },
        {
          type: 'link',
          label: 'Crew3 to Reputation',
          href: 'https://github.com/build-5/build5-otr-examples/blob/master/src/examples/crew3toAward/TUTORIAL.md',
        },
      ],
    },
    'architecture',
    'token-governance',
    'faqs',
    'limitations',
  ],
  apiSidebar: [
    {
      type: 'category',
      label: 'Reference API',
      collapsible: true,
      collapsed: true,
      items: [{ type: 'autogenerated', dirName: 'reference-api' }],
    }
  ],
};

module.exports = sidebars;
