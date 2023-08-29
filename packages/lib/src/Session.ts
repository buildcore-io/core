import { PING_INTERVAL, QUERY_MAX_LENGTH } from '@build-5/interfaces';
import { Build5Env, getKeepAliveUrl } from './Config';
import { wrappedFetch } from './fetch.utils';
import { randomString } from './utils';

class Session {
  public readonly sessionId = randomString();

  protected subscribtions: { [key: string]: boolean } = {};
  protected unsubscriptions: string[] = [];
  private isUnsubscribing = false;

  constructor(private readonly env: Build5Env) {
    setInterval(this.pingSubscriptions, PING_INTERVAL * 0.6);
    setInterval(this.closeConnections, 1000);
  }

  public subscribe = (sessionId: string) => {
    if (sessionId && !this.subscribtions[sessionId]) {
      this.subscribtions[sessionId] = true;
    }
  };

  public unsubscribe = (sessionId: string, connectionClosed = false) => {
    delete this.subscribtions[sessionId];
    if (sessionId && !connectionClosed && !this.unsubscriptions.includes(sessionId)) {
      this.unsubscriptions.push(sessionId);
    }
  };

  private pingSubscriptions = async () => {
    const allInstanceIds = Object.keys(this.subscribtions);
    await this.pingInstances(allInstanceIds, false);
  };

  private closeConnections = async () => {
    if (this.isUnsubscribing) {
      return;
    }
    this.isUnsubscribing = true;
    await this.pingInstances(this.unsubscriptions, true);
    this.isUnsubscribing = false;
  };

  private pingInstances = async (instanceIds: string[], close: boolean) => {
    while (instanceIds.length) {
      const sessionIds = instanceIds.splice(0, QUERY_MAX_LENGTH);
      const params = { sessionIds, close: sessionIds.map(() => close), version: 2 };
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
