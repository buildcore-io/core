import { SystemConfig } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgSystem } from '../../models';
import { removeNulls } from '../common';

export class SystemConverter implements Converter<SystemConfig, PgSystem> {
  toPg = (system: SystemConfig): PgSystem => ({
    uid: system.uid,
    tokenTradingFeePercentage: system.tokenTradingFeePercentage,
    tokenPurchaseFeePercentage: system.tokenPurchaseFeePercentage,
  });

  fromPg = (pg: PgSystem): SystemConfig =>
    removeNulls({
      uid: pg.uid,
      tokenTradingFeePercentage: pg.tokenTradingFeePercentage,
      tokenPurchaseFeePercentage: pg.tokenPurchaseFeePercentage,
    });
}
