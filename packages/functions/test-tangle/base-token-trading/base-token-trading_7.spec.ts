import { database } from '@buildcore/database';
import {
  COL,
  CreditPaymentReason,
  MIN_IOTA_AMOUNT,
  Network,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { cancelExpiredSale } from '../../src/cron/token.cron';
import { getAddress } from '../../src/utils/address.utils';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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
      mockWalletReturnValue(member.uid, {
        symbol: helper.token!.symbol,
        count: MIN_IOTA_AMOUNT,
        price: 1,
        type,
      });
      const tradeOrder = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
      await requestFundsFromFaucet(
        network,
        tradeOrder.payload.targetAddress,
        tradeOrder.payload.amount,
      );

      const tradeQuery = database()
        .collection(COL.TOKEN_MARKET)
        .where('token', '==', helper.token!.uid);
      await wait(async () => {
        const snap = await tradeQuery.get();
        return snap.length > 0;
      });
      let trade = <TokenTradeOrder>(await tradeQuery.get())[0];
      await database()
        .doc(COL.TOKEN_MARKET, trade.uid)
        .update({ expiresAt: dayjs().subtract(1, 'd').toDate() });

      await cancelExpiredSale();

      trade = <TokenTradeOrder>(await tradeQuery.get())[0];
      expect(trade.status).toBe(TokenTradeOrderStatus.EXPIRED);

      const creditDocRef = database().doc(COL.TRANSACTION, trade.creditTransactionId!);
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
