import { API_RETRY_TIMEOUT } from '@build-5/interfaces';
import { Observable as RxjsObservable, Subscriber, shareReplay } from 'rxjs';
import { Build5Env } from './Config';
import { getSession } from './Session';
import { wrappedFetchRaw } from './fetch.utils';
import { processObject, processObjectArray } from './utils';

const HEADERS = {
  Accept: 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

class Observable<T> extends RxjsObservable<T> {
  private observer: Subscriber<T> | undefined;
  private instaceId = '';
  private isRunning = true;

  constructor(protected readonly env: Build5Env, private readonly url: string) {
    super((observer) => {
      this.observer = observer;
      this.init();
      return this.closeConnection;
    });
  }

  private closeConnection = async () => {
    this.isRunning = false;
    getSession(this.env).unsubscribe(this.instaceId);
  };

  private init = async () => {
    try {
      this.isRunning = true;
      const response = await wrappedFetchRaw(this.url, { headers: HEADERS });
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status} ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (this.isRunning) {
        const result = await reader.read();

        if (result.done || !this.isRunning) {
          break;
        }

        buffer += decoder.decode(result.value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop()!;

        const promises = events.map(this.onEvent);
        await Promise.all(promises);
      }
    } catch {
      this.closeConnection();
      await new Promise((resolve) => setTimeout(resolve, API_RETRY_TIMEOUT));
      this.init();
    }
  };

  private onEvent = async (event: string) => {
    const type = this.getEventType(event);
    const data = this.getData(event);

    switch (type) {
      case 'update':
        this.onUpdate(data);
        break;
      case 'instance':
        this.onInstanceId(data);
        break;
      case 'error':
        this.observer!.error(data);
        break;
      case 'close':
        this.closeConnection();
        this.init();
        break;
    }
  };

  private onUpdate = (data: string) => {
    const parsed = JSON.parse(data);
    const processed = Array.isArray(parsed) ? processObjectArray(parsed) : processObject(parsed);
    this.observer!.next(processed as T);
  };

  private onInstanceId = (data: string) => {
    this.instaceId = data;
    getSession(this.env).subscribe(this.instaceId);
  };

  private getEventType = (event: string) => event.split('\n')[0].split(': ')[1];

  private getData = (event: string) => event.split('data: ')[1];
}

export const fetchLive = <T>(env: Build5Env, url: string): RxjsObservable<T> =>
  new Observable<T>(env, url).pipe(shareReplay({ refCount: true }));
