import { IndexerPluginClient } from '@iota/iota.js-next';
import {
  COL,
  Network,
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
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { generateRandomAmount } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const importMintedTokenControl = async (owner: string, params: Record<string, unknown>) =>
  soonDb().runTransaction(async (transaction) => {
    await assertIsGuardian(params.space as string, owner);

    const existingTokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.tokenId}`);
    const existingToken = await transaction.get(existingTokenDocRef);
    if (existingToken) {
      throw throwInvalidArgument(WenError.token_already_exists_for_space);
    }

    const wallet = (await WalletService.newWallet(params.network as Network)) as SmrWallet;
    const indexer = new IndexerPluginClient(wallet.client);
    const foundryResponse = await indexer.foundry(params.tokenId as string);

    if (isEmpty(foundryResponse.items)) {
      throw throwInvalidArgument(WenError.token_does_not_exist);
    }

    const targetAddress = await wallet.getNewIotaAddressDetails();
    const order = <Transaction>{
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: params.space,
      network: params.network,
      payload: {
        type: TransactionOrderType.IMPORT_TOKEN,
        amount: generateRandomAmount(),
        targetAddress: targetAddress.bech32,
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        validationType: TransactionValidationType.ADDRESS,
        reconciled: false,
        void: false,
        tokenId: params.tokenId,
      },
    };
    const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
    transaction.create(orderDocRef, order);
    return order;
  });
