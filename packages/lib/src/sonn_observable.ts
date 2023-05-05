import EventSource from 'eventsource';
import { Observable } from 'rxjs';
import { SoonEnv, getKeepAliveUrl } from './Config';
import { wrappedFetch } from './fetch.utils';

export class SoonObservable<T> extends Observable<T> {
  private eventSource: EventSource | undefined;
  constructor(protected readonly env: SoonEnv, url: string) {
    super((observer) => {
      this.eventSource = new EventSource(url);

      this.eventSource.onerror = (error) => {
        observer.error(error);
      };

      this.eventSource.addEventListener('close', () => {
        observer.complete();
      });

      this.eventSource.addEventListener('update', (event) => {
        observer.next(JSON.parse(event.data) as T);
      });

      this.eventSource.addEventListener('ping', async (event) => {
        const url = getKeepAliveUrl(this.env);
        await wrappedFetch(url, { instanceId: event.data });
      });

      return () => {
        this.eventSource?.close();
      };
    });
  }
}
