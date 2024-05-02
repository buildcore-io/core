require('dotenv').config({ path: (__dirname + '/.env').replace('test/', '') });
import { COL, getMilestoneCol, Network, SUB_COL } from '@buildcore/interfaces';
import { PubSub } from '@google-cloud/pubsub';
import { Client } from '@iota/sdk';
import axios from 'axios';
import dayjs from 'dayjs';
import Knex from 'knex';
import { head, uniq } from 'lodash';

const knex = Knex({
  client: 'pg',
  connection: {
    user: process.env.DB_USER,
    password: process.env.DB_USER_PWD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
  },
});

const upsertQueue: any[] = [];

const cleanAllTables = async () => {
  const tables = await knex('information_schema.tables')
    .select('table_name')
    .where('table_schema', 'public'); // Filter by schema if needed

  for (const table of tables.map((row) => row.table_name)) {
    if (table.includes('knex')) {
      continue;
    }
    await knex(table).delete();
  }
};

const notifier = async () => {
  await cleanAllTables();
  const connection = await knex.client.acquireConnection();

  connection.query(`LISTEN trigger`);
  connection.query(`LISTEN blocks`);
  connection.query(`LISTEN onupsert`);

  connection.on('notification', async (data: any) => {
    if (data.channel === 'blocks') {
      await onBlockCreated(data);
      return;
    }

    if (data.channel === 'trigger') {
      const [channel, changeId] = data.payload.split(':');
      if (channel === 'ontransactionwrite') {
        await transactionToBlock(changeId);
      }
      await notifyTriggers(channel, changeId);
      return;
    }

    if (data.channel === 'onupsert') {
      upsertQueue.push(JSON.parse(data.payload));
    }
  });

  process.stdin.resume();
};

const notifyTriggers = async (channel: string, changeId: string) => {
  const body = { message: { data: btoa(JSON.stringify({ processId: Number(changeId) })) } };

  let error: any = undefined;
  for (let i = 0; i < 5; ++i) {
    try {
      await axios.post('http://localhost:8080/' + channel, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 3 * 60000,
      });
      return;
    } catch (err: any) {
      error = err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw error;
};

const client = new Client({ nodes: ['https://rms1.svrs.io/'] });

const onBlockCreated = async (data: any) => {
  const blockId = data.payload;

  const metadata = await getBlockMetadata(blockId);
  if (metadata?.ledgerInclusionState !== 'included') {
    return;
  }
  const block = await client.getBlock(blockId);

  await knex(`${getMilestoneCol(Network.RMS)}_${SUB_COL.TRANSACTIONS}`).insert({
    uid: blockId,
    blockId,
    parentId: metadata.referencedByMilestoneIndex + '',
    milestone: metadata.referencedByMilestoneIndex + '',
    createdOn: dayjs().toDate(),
    payload: JSON.stringify(block.payload),
    processed: false,
  });
};

const getBlockMetadata = async (blockId: string) => {
  for (let attempt = 0; attempt < 1200; ++attempt) {
    const metadata = await client.getBlockMetadata(blockId);
    if (metadata.ledgerInclusionState) {
      return metadata;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return;
};

const transactionToBlock = async (changeId: string) => {
  const doc = await knex('changes').where({ uid: Number(changeId) });
  const transactionId = head(doc).change.uid;

  const query = knex(COL.TRANSACTION).where({ uid: transactionId });
  const transaction = head(await query);

  const blockId = transaction.payload_walletReference_chainReference;
  if (blockId && !blockId.startsWith('payment')) {
    await knex('blocks').insert({ blockId }).onConflict().ignore();
  }
};

const pubSub = new PubSub();

const upserTopic = pubSub.topic('onupsert');

const postDataToPubSub = async () => {
  const data = uniq(upsertQueue.splice(0));

  const promises = data.map(async (d) => {
    const pKey = d.parentId ? { uid: d.uid, parentId: d.parentId } : { uid: d.uid };
    const snap = head(await knex(d.table).where(pKey));
    if (!snap) {
      return;
    }
    await upserTopic.publishMessage({
      data: Buffer.from(JSON.stringify(snap)),
      attributes: { table: d.table },
    });
  });

  await Promise.all(promises);
};

setInterval(postDataToPubSub, 500);

notifier();
