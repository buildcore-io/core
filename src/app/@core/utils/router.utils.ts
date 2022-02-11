export const ROUTER_UTILS = {
  config: {
    base: {
      home: '',
      dashboard: 'dashboard',
    },
    auth: {
      root: 'auth',
      signIn: 'signIn'
    },
    market: {
      root: 'market',
      collections: 'collections',
      nfts: 'nfts',
    },
    discover: {
      root: 'discover',
      spaces: 'spaces',
      awards: 'awards',
      proposals: 'proposals',
      members: 'members',
      collections: 'collections'
    },
    member: {
      // Redirect back to discovery
      root: 'member',
      member: ':memberId',
      activity: 'activity',
      awards: 'awards',
      badges: 'badges',
      spaces: 'spaces',
      nfts: 'nfts'
    },
    space: {
      // Redirect back to discovery
      root: 'space',
      space: ':spaceId',
      new: 'new',
      edit: 'edit',
      overview: 'overview',
      proposals: 'proposals',
      awards: 'awards',
      treasury: 'treasury',
      members: 'members',
      collections: 'collections'
    },
    proposal: {
      // Redirect back to space?!
      root: 'proposal',
      newProposal: 'new',
      proposal: ':proposalId',
      overview: 'overview',
      participants: 'participants'
    },
    award: {
      // Redirect back to space?!
      root: 'award',
      newAward: 'new',
      award: ':awardId',
      overview: 'overview',
      participants: 'participants',
    },
    collection: {
      root: 'collection',
      new: 'new',
      edit: 'edit'
    },
    nft: {
      root: 'nft',
      newNft: 'new',
      single: 'single',
      multiple: 'multiple'
    },
    errorResponse: {
      notFound: '404',
    },
    about: {
      root: 'about'
    }
  },
};
