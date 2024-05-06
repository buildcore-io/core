import { Message } from '@google-cloud/pubsub';
import { get, head } from 'lodash';
import { getPgData, getSubscription } from '../../impl/pubsub';
import { BaseRecord } from '../../models/common';
import { Update } from '../../models/common_update';
import { IDocument } from './document';

export const onSnapshot = <C, B extends BaseRecord, U extends Update>(
  doc: IDocument<C, B, U>,
  callback: (data: C | undefined) => Promise<void> | void,
  onError?: (err: any) => void,
) => {
  const onMemssage = (message: Message) => {
    message.ack();
    const update = getPgData(message, doc.converter);
    if (update.uid === doc.pKey.uid && get(update, 'parentId') === doc.pKey.parentId) {
      callback(doc.converter.fromPg(update));
    }
  };

  const subsPromise = getSubscription(doc.table);

  doc
    .createQuery()
    .then(async (raw) => {
      const pgData = head(raw);
      callback(pgData ? doc.converter.fromPg(pgData) : undefined);
      (await subsPromise).on('message', onMemssage);
    })
    .catch(onError);

  return () => {
    subsPromise.then((subs) => {
      subs.removeListener('message', onMemssage);
    });
  };
};
