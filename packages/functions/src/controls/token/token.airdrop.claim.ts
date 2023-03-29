import {
  COL,
  DEFAULT_NETWORK,
  Space,
  Token,
  TokenStatus,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { soonDb } from '../../firebase/firestore/soondb';
import { WalletService } from '../../services/wallet/wallet';
import { getAddress } from '../../utils/address.utils';
import { generateRandomAmount } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertTokenStatus, getUnclaimedDrops } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const claimAirdroppedTokenControl = async (
  owner: string,
  params: Record<string, unknown>,
) => {
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.token}`);
  const token = await tokenDocRef.get<Token>();
  if (!token) {
    throw throwInvalidArgument(WenError.invalid_params);
  }

  assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED]);

  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${token.space}`);
  const space = await spaceDocRef.get<Space>();

  const tranId = getRandomEthAddress();
  const orderDocRef = soonDb().collection(COL.TRANSACTION).doc(tranId);

  const wallet = await WalletService.newWallet();
  const targetAddress = await wallet.getNewIotaAddressDetails();

  await soonDb().runTransaction(async (transaction) => {
    const claimableDrops = await getUnclaimedDrops(params.token as string, owner);
    if (isEmpty(claimableDrops)) {
      throw throwInvalidArgument(WenError.no_airdrop_to_claim);
    }
    const quantity = claimableDrops.reduce((sum, act) => sum + act.count, 0);

    const order = <Transaction>{
      type: TransactionType.ORDER,
      uid: tranId,
      member: owner,
      space: token.space,
      network: DEFAULT_NETWORK,
      payload: {
        type: TransactionOrderType.TOKEN_AIRDROP,
        amount: generateRandomAmount(),
        targetAddress: targetAddress.bech32,
        beneficiary: 'space',
        beneficiaryUid: token.space,
        beneficiaryAddress: getAddress(space, DEFAULT_NETWORK),
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
        reconciled: false,
        void: false,
        token: token.uid,
        quantity,
      },
    };
    transaction.create(orderDocRef, order);
  });

  return await orderDocRef.get<Transaction>();
};
