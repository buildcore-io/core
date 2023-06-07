import { Observable, Subscriber } from 'rxjs';
import { SoonEnv } from './Config';
import { processObject, processObjectArray } from './utils';

const HEADERS = {
  Accept: 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

export class SoonObservable<T> extends Observable<T> {
  private observer: Subscriber<T> | undefined;

  constructor(protected readonly env: SoonEnv, private readonly url: string) {
    super((observer) => {
      this.observer = observer;
      this.init();
    });
  }

  private init = async () => {
    try {
      const response = await fetch(this.url, { headers: HEADERS });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status} ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const result = await reader.read();

        if (result.done) {
          this.observer!.complete();
          break;
        }

        buffer += decoder.decode(result.value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop()!;

        const promises = events.map(this.onEvent);
        await Promise.all(promises);
      }
    } catch (error) {
      this.observer!.error(error);
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
    }
  };

  private getEventType = (event: string) => event.split('\n')[0].split(': ')[1];

  private getData = (event: string) => event.split('data: ')[1];
}
