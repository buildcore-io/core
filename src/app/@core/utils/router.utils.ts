import { URL_PATHS } from "@functions/interfaces/config";

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
      root: URL_PATHS.MEMBER,
      member: ':memberId',
      activity: 'activity',
      awards: 'awards',
      badges: 'badges',
      spaces: 'spaces',
      nfts: 'nfts'
    },
    space: {
      // Redirect back to discovery
      root: URL_PATHS.SPACE,
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
      root: URL_PATHS.PROPOSAL,
      newProposal: 'new',
      proposal: ':proposalId',
      overview: 'overview',
      participants: 'participants'
    },
    award: {
      // Redirect back to space?!
      root: URL_PATHS.AWARD,
      newAward: 'new',
      award: ':awardId',
      overview: 'overview',
      participants: 'participants',
    },
    collection: {
      root: URL_PATHS.COLLECTION,
      collection: ':collectionId',
      new: 'new',
      edit: 'edit'
    },
    nft: {
      root: URL_PATHS.NFT,
      newNft: 'new',
      nft: ':nftId',
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
