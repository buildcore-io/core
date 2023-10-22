import { build5Db } from '@build-5/database';
import {
  COL,
  ImportMintedTokenRequest,
  Network,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { WalletService } from '../../services/wallet/wallet.service';
import { generateRandomAmount, getProjects } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const importMintedTokenControl = async ({
  owner,
  params,
  project,
}: Context<ImportMintedTokenRequest>) =>
  build5Db().runTransaction(async (transaction) => {
    await assertIsGuardian(params.space, owner);

    const existingTokenDocRef = build5Db().doc(`${COL.TOKEN}/${params.tokenId}`);
    const existingToken = await transaction.get(existingTokenDocRef);
    if (existingToken) {
      throw invalidArgument(WenError.token_already_exists_for_space);
    }

    const wallet = await WalletService.newWallet(params.network as Network);
    const foundryOutputId = await wallet.client.foundryOutputId(params.tokenId);

    if (isEmpty(foundryOutputId)) {
      throw invalidArgument(WenError.token_does_not_exist);
    }

    const targetAddress = await wallet.getNewIotaAddressDetails();
    const order: Transaction = {
      project,
      projects: getProjects([], project),
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: params.space,
      network: params.network as Network,
      payload: {
        type: TransactionPayloadType.IMPORT_TOKEN,
        amount: generateRandomAmount(),
        targetAddress: targetAddress.bech32,
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        validationType: TransactionValidationType.ADDRESS,
        reconciled: false,
        void: false,
        tokenId: params.tokenId,
      },
    };
    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
    transaction.create(orderDocRef, order);
    return order;
  });
