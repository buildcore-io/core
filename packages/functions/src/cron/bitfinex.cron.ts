import { COL, TICKERS } from '@soonaverse/interfaces';
import axios from 'axios';
import admin from '../admin.config';
import { uOn } from '../utils/dateTime.utils';

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
      await admin
        .firestore()
        .collection(COL.TICKER)
        .doc(TICKERS.SMRUSD)
        .set(
          uOn({
            uid: TICKERS.SMRUSD,
            price: data[0][1],
          }),
        );
    }

    if (data[1][1] > 0) {
      await admin
        .firestore()
        .collection(COL.TICKER)
        .doc(TICKERS.IOTAUSD)
        .set(
          uOn({
            uid: TICKERS.IOTAUSD,
            price: data[1][1],
          }),
        );
    }
  } catch (e) {
    console.error('Failed to get latest prices. Try again in 5 minutes', e);
  }
};
