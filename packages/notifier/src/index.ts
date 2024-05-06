import { PubSub, Topic } from '@google-cloud/pubsub';
import Knex from 'knex';
import path from 'path';
import { logger } from './logger';
require('dotenv').config({ path: path.join(__dirname, '/../.env') });

const knex = Knex({
  client: 'pg',
  connection: {
    user: process.env.DB_USER,
    password: process.env.DB_USER_PWD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
  },
  pool: { max: 20 },
});

interface Upsert {
  table: string;
  uid: string;
  parentId?: string;
}
const upsertQueue: Upsert[] = [];

const notifier = async () => {
  const connection = await knex.client.acquireConnection();

  connection.query(`LISTEN trigger`, () => logger.info('Listenting to {trigger} events'));
  connection.query(`LISTEN onupsert`, () => logger.info('Listenting to {onupsert} events'));

  connection.on('notification', async (data: any) => {
    if (data.channel === 'trigger') {
      const [channel, processId] = data.payload.split(':');
      await notifyTriggers(channel, processId);
      return;
    }

    if (data.channel === 'onupsert') {
      upsertQueue.push(JSON.parse(data.payload));
      return;
    }
  });

  process.stdin.resume();
};

const pubSub = new PubSub();

const triggerTopics: { [key: string]: Topic } = {};

const getTriggerTopic = (topic: string) => {
  if (!triggerTopics[topic]) {
    triggerTopics[topic] = pubSub.topic(topic);
  }
  return triggerTopics[topic];
};

const notifyTriggers = async (channel: string, processId: string) => {
  await getTriggerTopic(channel).publishMessage({
    data: Buffer.from(JSON.stringify({ processId: Number(processId) })),
  });
};

const upserTopic = pubSub.topic('onupsert');

const postDataToPubSub = async () => {
  const data = new Set(upsertQueue.splice(0));

  const promises = [...data.values()].map(async (d) => {
    try {
      const pKey = d.parentId ? { uid: d.uid, parentId: d.parentId } : { uid: d.uid };
      const snap = (await knex(d.table).where(pKey))[0];
      if (!snap) {
        return;
      }
      await upserTopic.publishMessage({
        data: Buffer.from(JSON.stringify(snap)),
        attributes: { table: d.table },
      });
    } catch (err) {
      logger.error(err, d);
    }
  });

  await Promise.allSettled(promises);
};

setInterval(postDataToPubSub, 500);

notifier();
