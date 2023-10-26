/* eslint-disable import/namespace */
/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config({ path: __dirname + '/.env' });
import { WEN_FUNC } from '@build-5/interfaces';
import { HTTP } from 'cloudevents';
import cors from 'cors';
import express from 'express';
import { get } from 'lodash';
import { loadSync } from 'protobufjs';
import { flattenObject } from './common';
import { pathToParts } from './runtime/common';
import * as onScheduled from './runtime/cron/index';
import { ScheduledFunction } from './runtime/cron/scheduled';
import { HttpsFunction } from './runtime/https/https';
import * as onRequests from './runtime/https/index';
import { protoToJson } from './runtime/proto/protoToJson';
import * as onStorage from './runtime/storage/index';
import { StorageFunction } from './runtime/storage/storage';
import * as onTriggers from './runtime/trigger/index';
import { TriggeredFunction } from './runtime/trigger/trigger';

const app = express();

app.use(cors());

// HTTPS
const rawParser = express.raw({ type: '*/*' });
const jsonParser = express.json();
Object.entries(flattenObject(onRequests)).forEach(([name, config]) => {
  app.post(`/${name}`, name === WEN_FUNC.uploadFile ? rawParser : jsonParser, (req, res) =>
    (config as HttpsFunction).func(req, res),
  );
});

// TRIGGERS
Object.entries(flattenObject(onTriggers)).forEach(([name, config]) => {
  app.post(`/${name}`, express.raw({ type: 'application/protobuf' }), async (req, res) => {
    const root = loadSync('./data.proto');
    const type = root.lookupType('DocumentEventData');
    const decoded = type.decode(req.body);
    const json = protoToJson(decoded);
    const cloudEvent = HTTP.toEvent({
      headers: req.headers,
      body: {},
    });
    const event = {
      prev: json.oldValue?.fields,
      curr: json.value?.fields,
      path: get(cloudEvent, 'document', ''),
      ...pathToParts(get(cloudEvent, 'document', '')),
    };
    await (config as TriggeredFunction).handler(event);
    res.sendStatus(200);
  });
});

// CRON
Object.entries(flattenObject(onScheduled)).forEach(([name, config]) => {
  app.post(`/${name}`, async (_, res) => {
    await (config as ScheduledFunction).func();
    res.sendStatus(200);
  });
});

// Storage
Object.entries(flattenObject(onStorage)).forEach(([name, config]) => {
  app.post(`/${name}`, express.json(), async (req, res) => {
    const event = HTTP.toEvent({
      headers: req.headers,
      body: req.body,
    });
    await (config as StorageFunction).func({
      metadata: get(event, 'data.metadata'),
      name: get(event, 'data.name', ''),
      bucket: get(event, 'data.bucket', ''),
      contentType: get(event, 'data.contentType'),
    });
    res.sendStatus(200);
  });
});

app.listen(8080).setTimeout(0);
