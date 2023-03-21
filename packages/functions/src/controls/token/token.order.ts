import {
  COL,
  DEFAULT_NETWORK,
  Member,
  Space,
  Token,
  TokenStatus,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../database/wrapper/soondb';
import { assertHasAccess } from '../../services/validators/access';
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress, getAddress } from '../../utils/address.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIpNotBlocked } from '../../utils/ip.utils';
import { tokenIsInPublicSalePeriod, tokenOrderTransactionDocId } from '../../utils/token.utils';

export const orderTokenControl = async (
  owner: string,
  params: Record<string, unknown>,
  customParams?: Record<string, unknown>,
) => {
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get<Member>();
  assertMemberHasValidAddress(member, DEFAULT_NETWORK);

  const token = await soonDb().doc(`${COL.TOKEN}/${params.token}`).get<Token>();
  if (!token) {
    throw throwInvalidArgument(WenError.invalid_params);
  }

  if (isProdEnv()) {
    await assertIpNotBlocked((customParams?.ip as string) || '', token.uid, 'token');
  }

  if (!tokenIsInPublicSalePeriod(token) || token.status !== TokenStatus.AVAILABLE) {
    throw throwInvalidArgument(WenError.no_token_public_sale);
  }

  const tranId = tokenOrderTransactionDocId(owner, token);
  const orderDoc = soonDb().collection(COL.TRANSACTION).doc(tranId);
  const space = await soonDb().doc(`${COL.SPACE}/${token.space}`).get<Space>();

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
  await soonDb().runTransaction(async (transaction) => {
    const order = await transaction.get(orderDoc);
    if (!order) {
      const data = <Transaction>{
        type: TransactionType.ORDER,
        uid: tranId,
        member: owner,
        space: token.space,
        network,
        payload: {
          type: TransactionOrderType.TOKEN_PURCHASE,
          amount: token.pricePerToken,
          targetAddress: targetAddress.bech32,
          beneficiary: 'space',
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

  return await orderDoc.get<Transaction>();
};
