import {
  COL,
  ClaimPreMintedAirdroppedTokensRequest,
  DEFAULT_NETWORK,
  TRANSACTION_AUTO_EXPIRY_MS,
  Token,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { build5Db } from '../../firebase/firestore/build5Db';
import { WalletService } from '../../services/wallet/wallet.service';
import { generateRandomAmount } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertTokenStatus, getUnclaimedDrops } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const claimAirdroppedTokenControl = async (
  owner: string,
  params: ClaimPreMintedAirdroppedTokensRequest,
): Promise<Transaction> => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${params.token}`);
  const token = await tokenDocRef.get<Token>();
  if (!token) {
    throw invalidArgument(WenError.invalid_params);
  }

  assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED]);

  const tranId = getRandomEthAddress();
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${tranId}`);

  const wallet = await WalletService.newWallet();
  const targetAddress = await wallet.getNewIotaAddressDetails();

  await build5Db().runTransaction(async (transaction) => {
    const claimableDrops = await getUnclaimedDrops(params.token, owner);
    if (isEmpty(claimableDrops)) {
      throw invalidArgument(WenError.no_airdrop_to_claim);
    }
    const quantity = claimableDrops.reduce((sum, act) => sum + act.count, 0);

    const order: Transaction = {
      type: TransactionType.ORDER,
      uid: tranId,
      member: owner,
      space: token.space,
      network: DEFAULT_NETWORK,
      payload: {
        type: TransactionPayloadType.TOKEN_AIRDROP,
        amount: generateRandomAmount(),
        targetAddress: targetAddress.bech32,
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

  return (await orderDocRef.get())!;
};
