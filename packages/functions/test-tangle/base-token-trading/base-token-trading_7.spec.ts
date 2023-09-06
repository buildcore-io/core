import { build5Db } from '@build-5/database';
import {
  COL,
  CreditPaymentReason,
  MIN_IOTA_AMOUNT,
  Network,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { cancelExpiredSale } from '../../src/cron/token.cron';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([TokenTradeOrderType.SELL, TokenTradeOrderType.BUY])(
    'Should credit expired trade',
    async (type: TokenTradeOrderType) => {
      const network = type === TokenTradeOrderType.SELL ? Network.ATOI : Network.RMS;

      const member = type === TokenTradeOrderType.SELL ? helper.seller! : helper.buyer!;
      mockWalletReturnValue(helper.walletSpy, member.uid, {
        symbol: helper.token!.symbol,
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

      const tradeQuery = build5Db()
        .collection(COL.TOKEN_MARKET)
        .where('token', '==', helper.token!.uid);
      await wait(async () => {
        const snap = await tradeQuery.get();
        return snap.length > 0;
      });
      let trade = <TokenTradeOrder>(await tradeQuery.get())[0];
      await build5Db()
        .doc(`${COL.TOKEN_MARKET}/${trade.uid}`)
        .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'd')) });

      await cancelExpiredSale();

      trade = <TokenTradeOrder>(await tradeQuery.get())[0];
      expect(trade.status).toBe(TokenTradeOrderStatus.EXPIRED);

      const creditDocRef = build5Db().doc(`${COL.TRANSACTION}/${trade.creditTransactionId}`);
      await wait(async () => {
        const credit = <Transaction>await creditDocRef.get();
        return credit.payload?.walletReference?.confirmed;
      });
      const credit = <Transaction>await creditDocRef.get();
      expect(credit.member).toBe(member.uid);
      expect(credit.payload.targetAddress).toBe(getAddress(member, network));
      expect(credit.payload.amount).toBe(tradeOrder.payload.amount);
      expect(credit.payload.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);
    },
  );
});
