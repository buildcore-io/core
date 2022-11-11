import {
  COL,
  CreditPaymentReason,
  MIN_IOTA_AMOUNT,
  Network,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { tradeToken } from '../../src/controls/token-trading/token-trade.controller';
import { cancelExpiredSale } from '../../src/cron/token.cron';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeAll();
  });

  it.each([TokenTradeOrderType.SELL, TokenTradeOrderType.BUY])(
    'Should credit expired trade',
    async (type: TokenTradeOrderType) => {
      const network = type === TokenTradeOrderType.SELL ? Network.ATOI : Network.RMS;

      const member = type === TokenTradeOrderType.SELL ? helper.seller! : helper.buyer!;
      mockWalletReturnValue(helper.walletSpy, member.uid, {
        token: helper.token,
        count: MIN_IOTA_AMOUNT,
        price: 1,
        type,
      });
      const tradeOrder = await testEnv.wrap(tradeToken)({});
      await requestFundsFromFaucet(
        network,
        tradeOrder.payload.targetAddress,
        tradeOrder.payload.amount,
      );

      const tradeQuery = admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('token', '==', helper.token);
      await wait(async () => {
        const snap = await tradeQuery.get();
        return snap.size > 0;
      });
      let trade = <TokenTradeOrder>(await tradeQuery.get()).docs[0].data();
      await admin
        .firestore()
        .doc(`${COL.TOKEN_MARKET}/${trade.uid}`)
        .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'd')) });

      await cancelExpiredSale();

      trade = <TokenTradeOrder>(await tradeQuery.get()).docs[0].data();
      expect(trade.status).toBe(TokenTradeOrderStatus.EXPIRED);

      const creditDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${trade.creditTransactionId}`);
      await wait(async () => {
        const credit = <Transaction>(await creditDocRef.get()).data();
        return credit.payload?.walletReference?.confirmed;
      });
      const credit = <Transaction>(await creditDocRef.get()).data();
      expect(credit.member).toBe(member.uid);
      expect(credit.payload.targetAddress).toBe(getAddress(member, network));
      expect(credit.payload.amount).toBe(tradeOrder.payload.amount);
      expect(credit.payload.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);
    },
  );
});
