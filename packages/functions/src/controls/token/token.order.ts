import {
  COL,
  DEFAULT_NETWORK,
  Entity,
  Member,
  OrderTokenRequest,
  Space,
  Token,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../firebase/firestore/build5Db';
import { assertHasAccess } from '../../services/validators/access';
import { WalletService } from '../../services/wallet/wallet.service';
import { assertMemberHasValidAddress, getAddress } from '../../utils/address.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIpNotBlocked } from '../../utils/ip.utils';
import { tokenIsInPublicSalePeriod, tokenOrderTransactionDocId } from '../../utils/token.utils';
import { Context } from '../common';

export const orderTokenControl = async ({ ip, owner, params }: Context<OrderTokenRequest>) => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get<Member>();
  assertMemberHasValidAddress(member, DEFAULT_NETWORK);

  const token = await build5Db().doc(`${COL.TOKEN}/${params.token}`).get<Token>();
  if (!token) {
    throw invalidArgument(WenError.invalid_params);
  }

  if (isProdEnv()) {
    await assertIpNotBlocked(ip, token.uid, 'token');
  }

  if (!tokenIsInPublicSalePeriod(token) || token.status !== TokenStatus.AVAILABLE) {
    throw invalidArgument(WenError.no_token_public_sale);
  }

  const tranId = tokenOrderTransactionDocId(owner, token);
  const orderDoc = build5Db().doc(`${COL.TRANSACTION}/${tranId}`);
  const space = await build5Db().doc(`${COL.SPACE}/${token.space}`).get<Space>();

  await assertHasAccess(
    space!.uid,
    owner,
    token.access,
    token.accessAwards || [],
    token.accessCollections || [],
  );

  const network = DEFAULT_NETWORK;
  const newWallet = await WalletService.newWallet(network);
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  await build5Db().runTransaction(async (transaction) => {
    const order = await transaction.get<Transaction>(orderDoc);
    if (!order) {
      const data: Transaction = {
        type: TransactionType.ORDER,
        uid: tranId,
        member: owner,
        space: token.space,
        network,
        payload: {
          type: TransactionPayloadType.TOKEN_PURCHASE,
          amount: token.pricePerToken,
          targetAddress: targetAddress.bech32,
          beneficiary: Entity.SPACE,
          beneficiaryUid: token.space,
          beneficiaryAddress: getAddress(space, network),
          expiresOn: dateToTimestamp(
            dayjs(token.saleStartDate?.toDate()).add(token.saleLength || 0),
          ),
          validationType: TransactionValidationType.ADDRESS,
          reconciled: false,
          void: false,
          chainReference: null,
          token: token.uid,
        },
        linkedTransactions: [],
      };
      transaction.create(orderDoc, data);
    }
  });

  return (await orderDoc.get<Transaction>())!;
};
