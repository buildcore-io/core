import { Message, PubSub, Subscription } from '@google-cloud/pubsub';
import { Converter } from '../interfaces/common';
import { BaseRecord } from '../models/common';

const pubSub = new PubSub();
const topic = pubSub.topic('onupsert');

export const subscriptions: { [key: string]: Promise<Subscription> } = {};

export const getSubscription = (table: string) => {
  if (!subscriptions[table]) {
    const subsName = Math.random().toString().replace('0.', 'subs-onupsert-');
    subscriptions[table] = new Promise<Subscription>(async (res) => {
      const [subscription] = await topic.createSubscription(subsName, {
        filter: `attributes.table="${table}"`,
        ackDeadlineSeconds: 600,
        expirationPolicy: { ttl: { seconds: 86400 } },
      });
      subscription.setMaxListeners(0);
      res(subscription);
    });
  }
  return subscriptions[table];
};

export const getPgData = <C, Q extends BaseRecord>(
  message: Message,
  converter: Converter<C, Q>,
) => {
  const raw = JSON.parse(message.data.toString());
  return converter.toPg(converter.fromPg(raw));
};
