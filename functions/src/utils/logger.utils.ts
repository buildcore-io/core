/* eslint-disable @typescript-eslint/no-explicit-any */

import * as functions from 'firebase-functions';

export class Logger {
  private logs: any[][] = [];

  public add = (...log: any[]) => {
    this.logs.push(log);
  };

  public print = () => {
    this.logs.forEach((log) => functions.logger.warn(...log));
    this.logs = [];
  };
}
