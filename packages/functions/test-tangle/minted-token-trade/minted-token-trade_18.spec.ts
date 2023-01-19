import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper, VAULT_MNEMONIC } from './Helper';

describe('Minted toke trading tangle request', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.berforeAll();
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create buy with tangle request', async () => {
    const tmp = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, tmp.bech32, 10 * MIN_IOTA_AMOUNT);

    await helper.walletService!.send(tmp, tangleOrder.payload.targetAddress, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: helper.token!.symbol,
          count: 5,
          price: MIN_IOTA_AMOUNT,
        },
      },
    });
    await admin.firestore().doc(`${COL.MNEMONIC}/${tmp.bech32}`).update({ consumedOutputIds: [] });

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', tmp.bech32);
    await wait(async () => {
      const snap = await query.get();
      return snap.size > 0;
    });
    const snap = await query.get();
    const buyOrder = <TokenTradeOrder>snap.docs[0].data();
    expect(buyOrder.owner).toBe(tmp.bech32);
    expect(buyOrder.price).toBe(MIN_IOTA_AMOUNT);
    expect(buyOrder.count).toBe(5);
    expect(buyOrder.type).toBe(TokenTradeOrderType.BUY);
  });

  it.each([false, true])(
    'Should create sell with tangle request',
    async (hasExpiration: boolean) => {
      const expiresAt = hasExpiration
        ? dateToTimestamp(dayjs().add(2, 'h').toDate(), true)
        : undefined;
      await requestFundsFromFaucet(Network.RMS, helper.sellerAddress!.bech32, MIN_IOTA_AMOUNT);
      await requestMintedTokenFromFaucet(
        helper.walletService!,
        helper.sellerAddress!,
        helper.token!.mintingData?.tokenId!,
        VAULT_MNEMONIC,
      );

      await helper.walletService!.send(
        helper.sellerAddress!,
        tangleOrder.payload.targetAddress,
        MIN_IOTA_AMOUNT,
        {
          customMetadata: {
            request: {
              requestType: TangleRequestType.SELL_TOKEN,
              symbol: helper.token!.symbol,
              count: 5,
              price: MIN_IOTA_AMOUNT,
            },
          },
          nativeTokens: [
            { id: helper.token?.mintingData?.tokenId!, amount: HexHelper.fromBigInt256(bigInt(5)) },
          ],
          expiration: expiresAt
            ? { expiresAt, returnAddressBech32: helper.sellerAddress!.bech32 }
            : undefined,
        },
      );
      const query = admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', helper.seller);
      await wait(async () => {
        const snap = await query.get();
        return snap.size > 0;
      });
      const snap = await query.get();
      const sellOrder = <TokenTradeOrder>snap.docs[0].data();
      expect(sellOrder.owner).toBe(helper.seller!);
      expect(sellOrder.price).toBe(MIN_IOTA_AMOUNT);
      expect(sellOrder.count).toBe(5);
      expect(sellOrder.type).toBe(TokenTradeOrderType.SELL);

      if (expiresAt) {
        expect(sellOrder.expiresAt.isEqual(expiresAt)).toBe(true);
      } else {
        expect(sellOrder.expiresAt.toDate().getTime()).toBeGreaterThan(
          dayjs().add(30, 'd').toDate().getTime(),
        );
      }
    },
  );
});
