/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_RETRY_TIMEOUT } from '@buildcore/interfaces';
import { Observable as RxjsObservable, Subscriber, shareReplay } from 'rxjs';
import { processObject, processObjectArray } from '../utils';
const WebSocket = global.WebSocket || require('ws');

class Observable<T> extends RxjsObservable<T> {
  private observer: Subscriber<T> | undefined;
  private ws: WebSocket | undefined;

  constructor(
    private readonly apiKey: string,
    private readonly url: string,
  ) {
    super((observer) => {
      this.observer = observer;
      this.init();
      return this.closeConnection;
    });
  }

  private init = async () => {
    try {
      const url = new URL(this.url.replace('http', 'ws'));
      this.ws = new WebSocket(url);
      this.ws?.addEventListener('open', this.onOpen);
      this.ws?.addEventListener('message', this.onMessage);
      this.ws?.addEventListener('error', this.reconnect);
      this.ws?.addEventListener('close', this.reconnect);
    } catch {
      await this.reconnect();
    }
  };

  private onOpen = () => {
    this.ws!.send(this.apiKey);
  };

  private onMessage = (message: MessageEvent) => {
    const json = JSON.parse(message.data);
    const func = Array.isArray(json) ? processObjectArray : processObject;
    this.observer!.next(func(json) as T);
  };

  private reconnect = async () => {
    this.closeConnection();
    await new Promise((resolve) => setTimeout(resolve, API_RETRY_TIMEOUT));
    this.init();
  };

  private closeConnection = () => {
    this.ws?.removeEventListener('close', this.reconnect);
    this.ws?.removeEventListener('error', this.reconnect);
    this.ws?.removeEventListener('message', this.onMessage);
    if (this.ws?.readyState === 1) {
      this.ws?.close();
    }
  };
}

export const fetchLive = <T>(apiKey: string, url: string): RxjsObservable<T> =>
  new Observable<T>(apiKey, url).pipe(shareReplay({ refCount: true }));
