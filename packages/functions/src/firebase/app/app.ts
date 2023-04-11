import admin from 'firebase-admin';
import { IApp } from './interface';

export class FirebaseApp implements IApp {
  constructor(private readonly app: admin.app.App) {}

  /* eslint-disable @typescript-eslint/no-explicit-any */
  public getInstance = (): any => this.app;

  public getName = () => this.app.options.projectId!;
}
