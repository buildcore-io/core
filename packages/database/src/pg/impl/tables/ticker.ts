import { Ticker } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgTicker } from '../../models';

export class TickerConverter implements Converter<Ticker, PgTicker> {
  toPg = (ticker: Ticker): PgTicker => ({
    uid: ticker.uid,
    createdOn: ticker.createdOn?.toDate(),
    updatedOn: ticker.updatedOn?.toDate(),
    createdBy: ticker.createdBy,
    price: ticker.price,
  });

  fromPg = (ticker: PgTicker): Ticker => ({
    uid: ticker.uid,
    price: ticker.price || 0,
  });
}
