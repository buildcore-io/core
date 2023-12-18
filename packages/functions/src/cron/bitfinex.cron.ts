import { build5Db } from '@build-5/database';
import { COL, TICKERS } from '@build-5/interfaces';
import axios from 'axios';
import { logger } from '../utils/logger';

export const getLatestBitfinexPricesCron = async () => {
  try {
    const data: number[][] = (
      await axios.get(`https://api-pub.bitfinex.com/v2/tickers?symbols=tSMRUSD,tIOTUSD`, {
        data: {},
        headers: {
          'Content-Type': 'application/json',
        },
      })
    ).data;

    if (data[0][1] > 0) {
      await build5Db().collection(COL.TICKER).doc(TICKERS.SMRUSD).set({
        uid: TICKERS.SMRUSD,
        price: data[0][1],
      });
    }

    if (data[1][1] > 0) {
      await build5Db().collection(COL.TICKER).doc(TICKERS.IOTAUSD).set({
        uid: TICKERS.IOTAUSD,
        price: data[1][1],
      });
    }
  } catch (e) {
    logger.error('Failed to get latest prices. Try again in 5 minutes', e);
  }
};
