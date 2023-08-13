import { API_RETRY_TIMEOUT, PING_INTERVAL } from '@build-5/interfaces';
import { Build5Env, getKeepAliveUrl } from './Config';
import { wrappedFetch } from './fetch.utils';
import { BATCH_MAX_SIZE, BATCH_TIMEOUT } from './repositories/groupGet/common';
import { randomString } from './utils';

interface Request {
  sessionId: string;
  close?: boolean;
}

class Session {
  protected requests: Request[] = [];
  protected timer: Promise<void> | null = null;

  public readonly sessionId = randomString();

  constructor(private readonly env: Build5Env) {
    setInterval(async () => {
      this.pingSession(this.sessionId);
    }, PING_INTERVAL * 0.8);
  }

  public pingSession = async (sessionId: string, close = false) => {
    const request = this.requests.find((r) => r.sessionId === sessionId);
    if (request) {
      return;
    }
    this.requests.push({ sessionId, close });

    await this.executeTimed();
  };

  private executeRequests = async () => {
    const requests = this.requests.splice(0, BATCH_MAX_SIZE);
    if (!requests.length) {
      return;
    }
    const params = {
      sessionIds: requests.map((r) => r.sessionId),
      close: requests.map((r) => r.close),
    };
    try {
      await wrappedFetch(getKeepAliveUrl(this.env), params);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, API_RETRY_TIMEOUT));
      this.requests.push(...requests);
    }
  };

  private executeTimed = async () => {
    if (!this.timer) {
      this.timer = new Promise<void>((resolve) =>
        setTimeout(async () => {
          await this.executeRequests();
          resolve();
        }, BATCH_TIMEOUT),
      );
    }
    await this.timer;
    this.timer = null;
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
