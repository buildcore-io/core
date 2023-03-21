import {
  COL,
  DEFAULT_NETWORK,
  Member,
  MIN_IOTA_AMOUNT,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  Transaction,
  TransactionCreditType,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import { soonDb } from '../../database/wrapper/soondb';
import { getAddress } from '../../utils/address.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import {
  getBoughtByMemberDiff,
  memberDocRef,
  tokenIsInCoolDownPeriod,
  tokenOrderTransactionDocId,
} from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const creditTokenControl = async (owner: string, params: Record<string, unknown>) => {
  const tranId = getRandomEthAddress();
  const creditTranDoc = soonDb().collection(COL.TRANSACTION).doc(tranId);

  await soonDb().runTransaction(async (transaction) => {
    const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.token}`);
    const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(owner);

    const distribution = await transaction.get<TokenDistribution>(distributionDocRef);
    if (!distribution || (distribution.totalDeposit || 0) < (params.amount as number)) {
      throw throwInvalidArgument(WenError.not_enough_funds);
    }
    const token = await tokenDocRef.get<Token>();
    if (!token || !tokenIsInCoolDownPeriod(token) || token.status !== TokenStatus.AVAILABLE) {
      throw throwInvalidArgument(WenError.token_not_in_cool_down_period);
    }
    const member = <Member>(await memberDocRef(owner).get()).data();
    const orderDocRef = soonDb().doc(
      `${COL.TRANSACTION}/${tokenOrderTransactionDocId(owner, token)}`,
    );
    const order = (await transaction.get<Transaction>(orderDocRef))!;
    const payments = await transaction.getByQuery<Transaction>(allPaymentsQuery(owner, token.uid));

    const totalDepositLeft = (distribution.totalDeposit || 0) - (params.amount as number);
    const refundAmount =
      (params.amount as number) + (totalDepositLeft < MIN_IOTA_AMOUNT ? totalDepositLeft : 0);

    const boughtByMemberDiff = getBoughtByMemberDiff(
      distribution.totalDeposit || 0,
      totalDepositLeft || 0,
      token.pricePerToken,
    );
    transaction.update(distributionDocRef, {
      totalDeposit: soonDb().inc(-refundAmount),
    });
    transaction.update(tokenDocRef, {
      totalDeposit: soonDb().inc(-refundAmount),
      tokensOrdered: soonDb().inc(boughtByMemberDiff),
    });

    const creditTransaction = <Transaction>{
      type: TransactionType.CREDIT,
      uid: tranId,
      space: token.space,
      member: member.uid,
      network: order.network || DEFAULT_NETWORK,
      payload: {
        type: TransactionCreditType.TOKEN_PURCHASE,
        amount: refundAmount,
        sourceAddress: order.payload.targetAddress,
        targetAddress: getAddress(member, order.network || DEFAULT_NETWORK),
        sourceTransaction: payments.map((d) => d.uid),
        reconciled: true,
        void: false,
        token: token.uid,
        tokenSymbol: token.symbol,
      },
    };
    transaction.set(creditTranDoc, creditTransaction);
  });

  return await creditTranDoc.get<Transaction>();
};

const allPaymentsQuery = (member: string, token: string) =>
  soonDb()
    .collection(COL.TRANSACTION)
    .where('member', '==', member)
    .where('payload.token', '==', token);
