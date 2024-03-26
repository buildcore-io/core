/* eslint-disable import/namespace */
/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config({ path: __dirname + '/.env' });
import { BaseRecord, PgChanges, build5Db } from '@build-5/database';
import { WEN_FUNC } from '@build-5/interfaces';
import cors from 'cors';
import dayjs from 'dayjs';
import express from 'express';
import { get, head } from 'lodash';
import { flattenObject } from './common';
import * as onScheduled from './runtime/cron/index';
import { ScheduledFunction } from './runtime/cron/scheduled';
import { HttpsFunction } from './runtime/https/https';
import * as onRequests from './runtime/https/index';
import * as onStorage from './runtime/storage/index';
import { StorageFunction } from './runtime/storage/storage';
import * as onTriggers from './runtime/trigger/index';
import { TriggeredFunction } from './runtime/trigger/trigger';
import { tangleClients } from './services/wallet/wallet.service';
import { PgDocEvent } from './triggers/common';
import { isEmulatorEnv } from './utils/config.utils';
import { logger } from './utils/logger';
import { traceMiddleware } from './utils/trace';

const app = express();

app.use(cors());
app.use(traceMiddleware);

const httpRawParser = express.raw({ type: '*/*', limit: '100mb' });
const jsonParser = express.json();

const loggingMiddleware = (name: string) =>
  isEmulatorEnv()
    ? (_req: express.Request, res: express.Response, next: express.NextFunction) => {
        const start = dayjs();
        console.log(`Beginning ${name}`);
        next();
        res.once('finish', () => {
          const end = dayjs();
          console.log(`Finished ${name} in ${end.diff(start)} ms`);
        });
      }
    : (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
        next();
      };

// HTTPS
Object.entries(flattenObject(onRequests)).forEach(([name, config]) => {
  app.post(
    `/${name}`,
    name === WEN_FUNC.uploadFile ? httpRawParser : jsonParser,
    loggingMiddleware(name),
    (req, res) => (config as HttpsFunction).func(req, res),
  );
});

// TRIGGERS
Object.entries(flattenObject(onTriggers)).forEach(([name, config]) => {
  app.post(`/${name}`, jsonParser, loggingMiddleware(name), async (req, res) => {
    const pubSubMessage = req.body.message.data;
    const raw = Buffer.from(pubSubMessage, 'base64').toString().trim();
    const processId = JSON.parse(raw).processId;
    let snap: PgChanges | undefined = undefined;

    const docRef = build5Db().getCon()('changes').where({ uid: processId });
    try {
      snap = head(await docRef);
      if (!snap) {
        return;
      }

      await docRef.delete();

      await (config as TriggeredFunction).handler({
        ...snap.change,
        prev: snap.change!.prev || undefined,
        curr: snap.change!.curr || undefined,
      } as PgDocEvent<BaseRecord>);
    } catch (error) {
      logger.error('onTriggers-error', name, snap, error);
    } finally {
      res.sendStatus(200);
    }
  });
});

// CRON
Object.entries(flattenObject(onScheduled)).forEach(([name, config]) => {
  app.post(`/${name}`, async (_, res) => {
    try {
      await (config as ScheduledFunction).func();
    } catch (error) {
      logger.error('onScheduled-error', name, error);
    } finally {
      res.sendStatus(200);
    }
  });
});

// Storage
Object.entries(flattenObject(onStorage)).forEach(([name, config]) => {
  app.post(`/${name}`, jsonParser, loggingMiddleware(name), async (req, res) => {
    try {
      await (config as StorageFunction).func({
        metadata: get(req, 'body.metadata'),
        name: get(req, 'body.name', ''),
        bucket: get(req, 'body.bucket', ''),
        contentType: get(req, 'body.contentType'),
      });
    } catch (error) {
      logger.error('onStorage-error', name, error);
    } finally {
      res.sendStatus(200);
    }
  });
});

app.head('/', (_, res) => {
  res.sendStatus(200);
});

app.on('close', async () => {
  await build5Db().destroy();
});

const server = app.listen(8080).setTimeout(0);

process.on('exit', async () => {
  await cleanup();
});

process.on('SIGINT', () => {
  server.close(async () => {
    await cleanup();
    process.exit(0);
  });
});

process.on('uncaughtException', async () => {
  await cleanup();
  process.exit(1);
});

process.on('unhandledRejection', async () => {
  await cleanup();
  process.exit(1);
});

const cleanup = async () => {
  await build5Db().destroy();
  for (const client of Object.values(tangleClients)) {
    await client.destroy();
  }
};
