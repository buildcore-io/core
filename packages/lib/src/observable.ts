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

      return () => {
        this.isRunning = false;
        return new Promise<void>((res) => {
          if (this.instaceId) {
            getSession(env)
              .pingSession(this.instaceId, true)
              .then(() => {
                res();
              });
          } else {
            res();
          }
        });
      };
    });
  }

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

      // eslint-disable-next-line no-constant-condition
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
      this.isRunning = false;
      await getSession(this.env).pingSession(this.instaceId, true);
      this.init();
    }
  };

  private onEvent = async (event: string) => {
    const type = this.getEventType(event);
    const data = this.getData(event);

    if (type === 'update') {
      const parsed = JSON.parse(data);
      const processed = Array.isArray(parsed) ? processObjectArray(parsed) : processObject(parsed);
      this.observer!.next(processed as T);
      return;
    } else if (type === 'instance') {
      this.instaceId = data;
    } else if (type === 'error') {
      this.observer!.error(data);
    } else if (type === 'close') {
      this.isRunning = false;
      this.init();
    }
  };

  private getEventType = (event: string) => event.split('\n')[0].split(': ')[1];

  private getData = (event: string) => event.split('data: ')[1];
}

export const fetchLive = <T>(env: Build5Env, url: string): RxjsObservable<T> =>
  new Observable<T>(env, url).pipe(shareReplay({ refCount: true }));
