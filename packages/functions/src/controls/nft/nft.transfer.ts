import { build5Db } from '@build-5/database';
import { COL, NftTransferRequest, TransactionType } from '@build-5/interfaces';
import { createNftTransferData } from '../../services/payment/nft/nft-transfer.service';
import { Context } from '../common';

export const transferNftsControl = ({ owner, params, project }: Context<NftTransferRequest>) =>
  build5Db().runTransaction(async (transaction) => {
    const transfers = await createNftTransferData(transaction, project, owner, params.transfers);

    for (const [nftId, { code, nftUpdateData, order }] of Object.entries(transfers)) {
      if (code !== 200) {
        continue;
      }

      if (nftUpdateData) {
        const nftDocRef = build5Db().doc(COL.NFT, nftId);
        await transaction.update(nftDocRef, nftUpdateData);
      }

      if (order) {
        const tranDocRef = build5Db().doc(COL.TRANSACTION, order.uid);
        await transaction.create(tranDocRef, order);
      }

      if (order?.type === TransactionType.WITHDRAW_NFT) {
        const collectionDocRef = build5Db().doc(COL.COLLECTION, order.payload.collection!);
        await transaction.update(collectionDocRef, { total: build5Db().inc(-1) });
      }
    }

    return Object.entries(transfers).reduce(
      (acc, [key, { code }]) => ({ ...acc, [key]: code }),
      {} as { [key: string]: number },
    );
  });
