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
    member: {
      root: 'members',
      overview: 'overview',
      profile: ':username',
    },
    space: {
      root: 'spaces',
      space: ':username',
    },
    settings: {
      root: 'settings',
      account: 'account',
      appearance: 'appearance',
      billing: 'billing',
      blockedUsers: 'blocked-users',
      notifications: 'notifications',
      security: 'security',
      securityLog: 'security-log',
    },
    errorResponse: {
      notFound: '404',
    },
  },
};
