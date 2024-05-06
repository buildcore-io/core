import { database } from '@buildcore/database';
import { COL, TICKERS } from '@buildcore/interfaces';
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
      await database().doc(COL.TICKER, TICKERS.SMRUSD).upsert({ price: data[0][1] });
    }
    if (data[1][1] > 0) {
      await database().doc(COL.TICKER, TICKERS.IOTAUSD).upsert({ price: data[1][1] });
    }
  } catch (error) {
    logger.error('Failed to get latest prices. Try again in 5 minutes', error);
  }
};
