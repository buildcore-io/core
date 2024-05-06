import { database } from '@buildcore/database';
import { COL, NftTransferRequest, TransactionType } from '@buildcore/interfaces';
import { createNftTransferData } from '../../services/payment/nft/nft-transfer.service';
import { Context } from '../common';

export const transferNftsControl = ({ owner, params, project }: Context<NftTransferRequest>) =>
  database().runTransaction(async (transaction) => {
    const transfers = await createNftTransferData(transaction, project, owner, params.transfers);

    for (const [nftId, { code, nftUpdateData, order }] of Object.entries(transfers)) {
      if (code !== 200) {
        continue;
      }

      if (nftUpdateData) {
        const nftDocRef = database().doc(COL.NFT, nftId);
        await transaction.update(nftDocRef, nftUpdateData);
      }

      if (order) {
        const tranDocRef = database().doc(COL.TRANSACTION, order.uid);
        await transaction.create(tranDocRef, order);
      }

      if (order?.type === TransactionType.WITHDRAW_NFT) {
        const collectionDocRef = database().doc(COL.COLLECTION, order.payload.collection!);
        await transaction.update(collectionDocRef, { total: database().inc(-1) });
      }
    }

    return Object.entries(transfers).reduce(
      (acc, [key, { code }]) => ({ ...acc, [key]: code }),
      {} as { [key: string]: number },
    );
  });
