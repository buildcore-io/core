import { COL, TICKERS } from '@soonaverse/interfaces';
import axios from 'axios';
import admin from '../admin.config';
import { uOn } from '../utils/dateTime.utils';

export const getLatestBitfinexPricesCron = async () => {
  try {
    const smrUsd: number[] = (await axios.get(`https://api-pub.bitfinex.com/v2/ticker/tSMRUSD`))
      .data;
    const iotaUsd: number[] = (await axios.get(`https://api-pub.bitfinex.com/v2/ticker/tIOTUSD`))
      .data;
    await admin
      .firestore()
      .collection(COL.TICKER)
      .doc(TICKERS.SMRUSD)
      .set(
        uOn({
          uid: TICKERS.SMRUSD,
          price: smrUsd[0],
        }),
      );

    await admin
      .firestore()
      .collection(COL.TICKER)
      .doc(TICKERS.IOTAUSD)
      .set(
        uOn({
          uid: TICKERS.IOTAUSD,
          price: iotaUsd[0],
        }),
      );
  } catch (e) {
    console.error('Failed to get latest prices. Try again in 5 minutes', e);
  }
};
