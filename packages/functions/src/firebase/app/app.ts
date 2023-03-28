import { App } from 'firebase-admin/app';
import { IApp } from './interface';

export class FirebaseApp implements IApp {
  constructor(private readonly app: App) {}

  /* eslint-disable @typescript-eslint/no-explicit-any */
  public getInstance = (): any => this.app;

  public getName = () => this.app.options.projectId!;
}
