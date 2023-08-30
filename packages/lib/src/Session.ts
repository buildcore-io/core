import { PING_INTERVAL, QUERY_MAX_LENGTH } from '@build-5/interfaces';
import { Build5Env, getKeepAliveUrl } from './Config';
import { wrappedFetch } from './fetch.utils';
import { randomString } from './utils';

class Session {
  public readonly sessionId = randomString();

  protected subscribtions: { [key: string]: boolean } = {};

  constructor(private readonly env: Build5Env) {
    setInterval(this.pingSubscriptions, PING_INTERVAL * 0.7);
  }

  public subscribe = (instanceId: string) => {
    if (instanceId && !this.subscribtions[instanceId]) {
      this.subscribtions[instanceId] = true;
    }
  };

  public unsubscribe = (instanceId: string) => {
    delete this.subscribtions[instanceId];
  };

  private pingSubscriptions = async () => {
    const allInstanceIds = Object.keys(this.subscribtions);
    await this.pingInstances(allInstanceIds);
  };

  private pingInstances = async (allInstanceIds: string[]) => {
    while (allInstanceIds.length) {
      const instanceIds = allInstanceIds.splice(0, QUERY_MAX_LENGTH);
      const params = { sessionId: getSessionId(this.env), instanceIds, version: 3 };
      try {
        await wrappedFetch(getKeepAliveUrl(this.env), params);
      } catch {
        // eslint-disable-next-line no-empty
      }
    }
  };
}

const sessions: { [key: string]: Session } = {};

export const getSession = (env: Build5Env) => {
  if (!sessions[env]) {
    sessions[env] = new Session(env);
  }
  return sessions[env];
};

export const getSessionId = (env: Build5Env) => getSession(env).sessionId;
