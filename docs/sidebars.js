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
      collapsible: true,
      collapsed: false,
      items: [
        {
          'DAO Management API': ['products/dao_management/overview'],
        },
        {
          'Digital Twin NFT': ['products/digital_twin_nft/overview'],
        },
        {
          'NFT API': ['products/nft/overview'],
        },
        {
          'NFT Trading API': ['products/nft_trading/overview'],
        },
        {
          'NFT Staking API': ['products/nft_staking/overview'],
        },
        {
          'Member API': ['products/member/overview'],
        },
        {
          'Project API*': ['products/project/overview'],
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
      items: [{ type: 'autogenerated', dirName: 'api-models' }],
    },
    {
      type: 'category',
      label: 'GET Requests',
      collapsible: true,
      collapsed: true,
      items: [{ type: 'autogenerated', dirName: 'api-get' }],
    },
    {
      type: 'category',
      label: 'OTR Requests',
      collapsible: true,
      collapsed: true,
      items: [{ type: 'autogenerated', dirName: 'api-otr' }],
    },
    {
      type: 'category',
      label: 'POST Requets',
      collapsible: true,
      collapsed: true,
      items: [{ type: 'autogenerated', dirName: 'api-post' }],
    },
  ],
};

module.exports = sidebars;
