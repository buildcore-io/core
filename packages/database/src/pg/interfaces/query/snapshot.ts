import { Message, Subscription } from '@google-cloud/pubsub';
import { get, gt, gte, isEqual, lt, lte, orderBy, take } from 'lodash';
import { getPgData, getSubscription } from '../../impl/pubsub';
import { WhereFilterOp } from '../common';
import { IQuery } from './query';

export class OnSnapshot {
  private subscription: Promise<Subscription>;
  private interval: NodeJS.Timeout | undefined;

  private allData: any[] = [];
  private rightData: any[] = [];

  constructor(
    private query: IQuery<any, any>,
    private callback: (data: any[]) => Promise<void> | void,
    private onError?: (err: any) => void,
  ) {
    this.subscription = getSubscription(query.table);

    query
      .createQuery()
      .then(async (raw: any[]) => {
        this.allData = raw;
        this.rightData = raw;

        this.callback(this.rightData.map(query.converter.fromPg));

        this.interval = setInterval(this.filter, 500);

        (await this.subscription).on('message', this.onMessage);
      })
      .catch(this.onError);
  }

  unsubscrib = () => {
    clearInterval(this.interval);
    this.subscription.then((subs) => {
      subs.removeListener('message', this.onMessage);
    });
  };

  private onMessage = (message: Message) => {
    message.ack();

    const update = getPgData(message, this.query.converter);
    const index = this.allData.findIndex(
      (d) => d.uid === update.uid && d.parentId === update.parentId,
    );

    if (index === -1) {
      this.allData.push(update);
      return;
    }
    this.allData[index] = update;
  };

  private filter = () => {
    let allData = this.allData.splice(0);
    if (!allData.length) {
      return;
    }

    allData = allData.filter(this.shouldSelectData);

    const orderBys = [...this.query.orderBys];
    const orderKeys = orderBys.map((o) => o.key);
    if (!orderKeys.includes('uid')) {
      orderBys.push({ key: 'uid', dir: 'asc' });
    }
    allData = orderBy(
      allData,
      orderBys.map((o) => o.key),
      orderBys.map((o) => o.dir),
    );

    if (this.query.limits) {
      allData = take(allData, this.query.limits);
    }

    if (isEqual(this.rightData, allData)) {
      return;
    }

    this.rightData = allData;
    this.callback(this.rightData.map(this.query.converter.fromPg));
  };

  private shouldSelectData = (data: any) => {
    for (const ins of this.query.whereIns) {
      const value = get(data, ins.key);
      if (!ins.value.includes(value)) {
        return false;
      }
    }

    for (const wheres of this.query.wheres) {
      const value = get(data, wheres.key);
      if (!cmpWithLodash(value, wheres.opr, wheres.value)) {
        return false;
      }
    }

    const whereOrsOk = this.query.whereOrs.reduce((acc, act) => {
      for (const [key, value] of Object.entries(act)) {
        if (isEqual(get(data, key), value)) {
          return acc && true;
        }
      }
      return false;
    }, true);

    return whereOrsOk;
  };
}

const cmpWithLodash = (a: any, opr: WhereFilterOp, b: any) => {
  switch (opr) {
    case '!=':
      return !isEqual(a, b);
    case '<':
      return lt(a, b);
    case '<=':
      return lte(a, b);
    case '==':
      return isEqual(a, b);
    case '>':
      return gt(a, b);
    case '>=':
      return gte(a, b);
    case 'array-contains':
      return a.includes(b);
  }
};
