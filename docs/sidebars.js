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
    'on-tangle-request',
    {
      type: 'category',
      label: 'Products',
      link: {type: 'doc', id: 'products/overview'},
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
            'products/dao-management/overview',
            {
              type: 'category',
              label: 'Member',
              link: {type: 'doc', id: 'products/dao-management/member/overview'},
              items: [
                {
                  'How To': [
                    'products/dao-management/member/how-to/create-member',
                    'products/dao-management/member/how-to/update-member',
                    'products/dao-management/member/how-to/validate-address',
                    'products/dao-management/member/how-to/get-member',
                  ],
                }
              ],
            },
            {
              type: 'category',
              label: 'Space',
              link: {type: 'doc', id: 'products/dao-management/space/overview'},
              items: [
                {
                  'How To': [
                    'products/dao-management/space/how-to/create-space',
                    'products/dao-management/space/how-to/update-space',
                    'products/dao-management/space/how-to/validate-address',
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
                'products/nft/how-to/create-collection',
                'products/nft/how-to/bulk-purchase',
                'products/nft/how-to/create-metadata',
                'products/nft/how-to/transfer',
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
          'NFT Trading API': ['products/nft-trading/overview'],
        },
        {
          'NFT Staking API': ['products/nft-staking/overview'],
        },
        {
          'Proposal API': ['products/proposal/overview'],
        },
        {
          'Reputation API': ['products/reputation/overview'],
        },
        {
          'Stake Reward API': ['products/stake-reward/overview'],
        },
        {
          'Token API': [
            'products/token/overview',
            {
              'How To': [
                'products/token/how-to/create-token',
                'products/token/how-to/trade-token',
              ],
            }
          ],
        },
        {
          'Token Launchpad API': ['products/token-launchpad/overview'],
        },
        {
          'Token Trading API': ['products/token-trading/overview'],
        },
        {
          'Token Staking API': ['products/token-staking/overview'],
        },
        {
          'Token Distribution API': ['products/token-distribution/overview'],
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
