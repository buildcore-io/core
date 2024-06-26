import { database } from '@buildcore/database';
import {
  COL,
  DEFAULT_NETWORK,
  Entity,
  OrderTokenRequest,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { assertHasAccess } from '../../services/validators/access';
import { WalletService } from '../../services/wallet/wallet.service';
import { assertMemberHasValidAddress, getAddress } from '../../utils/address.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIpNotBlocked } from '../../utils/ip.utils';
import { tokenIsInPublicSalePeriod, tokenOrderTransactionDocId } from '../../utils/token.utils';
import { Context } from '../common';

export const orderTokenControl = async ({
  ip,
  owner,
  params,
  project,
}: Context<OrderTokenRequest>) => {
  const memberDocRef = database().doc(COL.MEMBER, owner);
  const member = await memberDocRef.get();
  assertMemberHasValidAddress(member, DEFAULT_NETWORK);

  const token = await database().doc(COL.TOKEN, params.token).get();
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
  const space = await database().doc(COL.SPACE, token.space!).get();

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
  const orderDoc = database().doc(COL.TRANSACTION, tranId);

  await database().runTransaction(async (transaction) => {
    const order = await transaction.get(orderDoc);
    if (!order) {
      const data: Transaction = {
        project,
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
      await transaction.create(orderDoc, data);
    }
  });

  return (await orderDoc.get())!;
};
