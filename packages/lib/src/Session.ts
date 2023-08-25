import { API_RETRY_TIMEOUT, PING_INTERVAL } from '@build-5/interfaces';
import { Build5Env, getKeepAliveUrl } from './Config';
import { wrappedFetch } from './fetch.utils';
import { randomString } from './utils';

class Session {
  public readonly sessionId = randomString();

  protected subscribtions: { [key: string]: boolean } = {};
  protected unsubscriptions: string[] = [];
  private isUnsubscribing = false;

  constructor(private readonly env: Build5Env) {
    setInterval(this.pingSubscriptions, PING_INTERVAL * 0.8);
    setInterval(this.closeConnections, 200);
  }

  public subscribe = (sessionId: string) => {
    if (!this.subscribtions[sessionId]) {
      this.subscribtions[sessionId] = true;
    }
  };

  public unsubscribe = (sessionId: string) => {
    if (!this.unsubscriptions.includes(sessionId)) {
      this.unsubscriptions.push(sessionId);
    }
    delete this.subscribtions[sessionId];
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
      const sessionIds = instanceIds.splice(0, 100);
      const params = { sessionIds, close: sessionIds.map(() => close) };
      try {
        await wrappedFetch(getKeepAliveUrl(this.env), params);
      } catch {
        await new Promise((resolve) => setTimeout(resolve, API_RETRY_TIMEOUT));
        instanceIds.push(...sessionIds);
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
