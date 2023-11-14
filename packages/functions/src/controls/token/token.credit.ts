import { build5Db } from '@build-5/database';
import {
  COL,
  CreditTokenRequest,
  DEFAULT_NETWORK,
  MIN_IOTA_AMOUNT,
  Member,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import { getAddress } from '../../utils/address.utils';
import { invalidArgument } from '../../utils/error.utils';
import {
  getBoughtByMemberDiff,
  memberDocRef,
  tokenIsInCoolDownPeriod,
  tokenOrderTransactionDocId,
} from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const creditTokenControl = async ({
  project,
  owner,
  params,
}: Context<CreditTokenRequest>): Promise<Transaction> => {
  const tranId = getRandomEthAddress();
  const creditTranDoc = build5Db().doc(`${COL.TRANSACTION}/${tranId}`);

  await build5Db().runTransaction(async (transaction) => {
    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${params.token}`);
    const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(owner);
    const distribution = await transaction.get<TokenDistribution>(distributionDocRef);
    if (!distribution || (distribution.totalDeposit || 0) < params.amount) {
      throw invalidArgument(WenError.not_enough_funds);
    }
    const token = await tokenDocRef.get<Token>();
    if (!token || !tokenIsInCoolDownPeriod(token) || token.status !== TokenStatus.AVAILABLE) {
      throw invalidArgument(WenError.token_not_in_cool_down_period);
    }
    const member = <Member>await memberDocRef(owner).get();
    const orderDocRef = build5Db().doc(
      `${COL.TRANSACTION}/${tokenOrderTransactionDocId(owner, token)}`,
    );
    const order = (await transaction.get<Transaction>(orderDocRef))!;
    const payments = await transaction.getByQuery<Transaction>(allPaymentsQuery(owner, token.uid));

    const totalDepositLeft = (distribution.totalDeposit || 0) - params.amount;
    const refundAmount =
      params.amount + (totalDepositLeft < MIN_IOTA_AMOUNT ? totalDepositLeft : 0);

    const boughtByMemberDiff = getBoughtByMemberDiff(
      distribution.totalDeposit || 0,
      totalDepositLeft || 0,
      token.pricePerToken,
    );
    transaction.update(distributionDocRef, {
      totalDeposit: build5Db().inc(-refundAmount),
    });
    transaction.update(tokenDocRef, {
      totalDeposit: build5Db().inc(-refundAmount),
      tokensOrdered: build5Db().inc(boughtByMemberDiff),
    });

    const creditTransaction: Transaction = {
      project,
      type: TransactionType.CREDIT,
      uid: tranId,
      space: token.space,
      member: member.uid,
      network: order.network || DEFAULT_NETWORK,
      payload: {
        type: TransactionPayloadType.TOKEN_PURCHASE,
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

  return (await creditTranDoc.get())!;
};

const allPaymentsQuery = (member: string, token: string) =>
  build5Db()
    .collection(COL.TRANSACTION)
    .where('member', '==', member)
    .where('payload.token', '==', token);
