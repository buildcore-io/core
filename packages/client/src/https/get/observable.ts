/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_RETRY_TIMEOUT } from '@build-5/interfaces';
import { Observable as RxjsObservable, Subscriber, shareReplay } from 'rxjs';
import { processObject, processObjectArray } from '../utils';
import { API_KEY, Build5 } from '..';
const WebSocket = global.WebSocket || require('ws');

class Observable<T> extends RxjsObservable<T> {
  private observer: Subscriber<T> | undefined;
  private ws: WebSocket | undefined;

  constructor(
    protected readonly origin: Build5,
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
      this.ws?.addEventListener('error', this.onError);
      this.ws?.addEventListener('close', this.onClose);
    } catch {
      await this.onThrow();
    }
  };

  private onOpen = () => {
    this.ws!.send(API_KEY[this.origin]);
  };

  private onMessage = (message: MessageEvent) => {
    const json = JSON.parse(message.data);
    const func = Array.isArray(json) ? processObjectArray : processObject;
    this.observer!.next(func(json) as T);
  };

  private onError = () => {
    this.closeConnection();
    this.observer?.error(new Error(this.url.replace('http', 'ws')));
  };

  private onClose = async (closeEvent: CloseEvent) => {
    this.closeConnection();
    if (closeEvent.code === 1000) {
      await new Promise((resolve) => setTimeout(resolve, API_RETRY_TIMEOUT));
      this.init();
    } else {
      this.observer?.error(new Error(this.url.replace('http', 'ws')));
    }
  };

  private onThrow = async () => {
    this.closeConnection();
    await new Promise((resolve) => setTimeout(resolve, API_RETRY_TIMEOUT));
    this.init();
  };

  private closeConnection = () => {
    this.ws?.removeEventListener('close', this.onClose);
    this.ws?.removeEventListener('error', this.onError);
    this.ws?.removeEventListener('message', this.onMessage);
    if (this.ws?.readyState === 1) {
      this.ws?.close();
    }
  };
}

export const fetchLive = <T>(origin: Build5, url: string): RxjsObservable<T> =>
  new Observable<T>(origin, url).pipe(shareReplay({ refCount: true }));
