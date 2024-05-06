import { AsyncLocalStorage } from 'async_hooks';
import express from 'express';

interface Trace {
  trace: string;
}

export const traceCtx = new AsyncLocalStorage<Trace>();

export const traceMiddleware = (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
) => {
  const traceHeader = req.header('X-Cloud-Trace-Context');
  const [trace] = (traceHeader || '').split('/');

  traceCtx.run({ trace }, () => {
    next();
  });
};
