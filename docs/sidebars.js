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
    'getting_started',
    {
      type: 'category',
      label: 'Products',
      link: {
        type: 'generated-index',
        title: 'BUILD.5 Products',
        description: 'Learn about the BUILD.5 products and how to use them.',
        slug: '/products',
        keywords: ['products', 'api', 'blockchain', 'nft', 'digital twin', 'token', 'staking', 'trading', 'launchpad', 'staking', 'reputation', 'member', 'project', 'proposal', 'stake reward', 'token distribution', 'dao management'],
      },
      collapsible: true,
      collapsed: false,
      items: [
        {
          'Project API': [
            'products/project/overview',
            {
              'How To': [
                'products/project/how-to/create-project',
              ],
            }
          ],
        },
        {
          'DAO Management API': [
            'products/dao_management/overview',
            {
              type: 'category',
              label: 'Space',
              link: {type: 'doc', id: 'products/dao_management/space/overview'},
              items: [
                {
                  'How To': [
                    'products/dao_management/space/how-to/create-space',
                  ],
                }
              ],
            },
            {
              type: 'category',
              label: 'Member',
              link: {type: 'doc', id: 'products/dao_management/member/overview'},
              items: [
                {
                  'How To': [
                    'products/dao_management/member/how-to/create-member',
                    'products/dao_management/member/how-to/update-member',
                  ],
                }
              ],
            },
          ],
        },
        {
          'NFT API': [
            'products/nft/overview',
            {
              'How To': [
                'products/nft/how-to/create-nft-collection',
              ],
            }
          ],
        },
        {
          'Stamp API': [
            'products/stamp/overview',
            {
              'How To': [
                'products/stamp/how-to/create-stamp',
              ],
            }
          ],
        },
        {
          'Digital Twin NFT': ['products/digital_twin_nft/overview'],
        },
        {
          'NFT Trading API': ['products/nft_trading/overview'],
        },
        {
          'NFT Staking API': ['products/nft_staking/overview'],
        },
        {
          'Proposal API': ['products/proposal/overview'],
        },
        {
          'Reputation API': ['products/reputation/overview'],
        },
        {
          'Stake Reward API': ['products/stake_reward/overview'],
        },
        {
          'Token API': ['products/token/overview'],
        },
        {
          'Token Launchpad API': ['products/token_launchpad/overview'],
        },
        {
          'Token Trading API': ['products/token_trading/overview'],
        },
        {
          'Token Staking API': ['products/token_staking/overview'],
        },
        {
          'Token Distribution API': ['products/token_distribution/overview'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Tutorials',
      link: {
        type: 'generated-index',
        title: 'Tutorials',
        description: 'List of tutorials for the BUILD.5 products.',
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
    'token_governance',
    'faqs',
    'limitations',
  ],
  apiSidebar: [
    {
      type: 'category',
      label: 'Models',
      collapsible: true,
      collapsed: true,
      items: [{ type: 'autogenerated', dirName: 'search-models' }],
    },
    {
      type: 'category',
      label: 'GET Requests',
      collapsible: true,
      collapsed: true,
      items: [{ type: 'autogenerated', dirName: 'search-get' }],
    },
    {
      type: 'category',
      label: 'OTR Requests',
      collapsible: true,
      collapsed: true,
      items: [{ type: 'autogenerated', dirName: 'search-otr' }],
    },
    {
      type: 'category',
      label: 'POST Requets',
      collapsible: true,
      collapsed: true,
      items: [{ type: 'autogenerated', dirName: 'search-post' }],
    },
  ],
};

module.exports = sidebars;
