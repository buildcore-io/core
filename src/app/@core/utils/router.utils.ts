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
    discover: {
      root: 'discover',
      spaces: 'spaces',
      awards: 'awards',
      proposals: 'proposals',
      members: 'members'
    },
    member: {
      // Redirect back to discovery
      root: 'member',
      member: ':memberId',
      activity: 'activity',
      awards: 'awards',
      badges: 'badges',
      yield: 'yield',
    },
    space: {
      // Redirect back to discovery
      root: 'space',
      space: ':spaceId',
      newSpace: 'new',
      overview: 'overview',
      proposals: 'proposals',
      awards: 'awards',
      funding: 'funding',
      members: 'members',
    },
    proposal: {
      // Redirect back to space?!
      root: 'proposal',
      newProposal: 'new',
      proposal: ':spaceId',
      overview: 'overview',
    },
    award: {
      // Redirect back to space?!
      root: 'award',
      newAward: 'new',
      award: ':spaceId',
      overview: 'overview',
      participants: 'participants',
    },
    errorResponse: {
      notFound: '404',
    },
  },
};
