/* eslint-disable import/namespace */

import { HTTP } from 'cloudevents';
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

// HTTPS
Object.entries(flattenObject(onRequests)).forEach(([name, config]) => {
  app.post(`/${name}`, express.json(), (req, res) => (config as HttpsFunction).func(req, res));
});

// TRIGGERS
Object.entries(flattenObject(onTriggers)).forEach(([name, config]) => {
  app.post(`/${name}`, app.use(express.raw({ type: 'application/protobuf' })), async (req, res) => {
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
    res.send(200);
  });
});

// CRON
Object.entries(flattenObject(onScheduled)).forEach(([name, config]) => {
  app.post(`/${name}`, async (_, res) => {
    await (config as ScheduledFunction).func();
    res.send(200);
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
    res.send(200);
  });
});

app.listen(8080).setTimeout(0);
