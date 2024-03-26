import { build5Db } from '@build-5/database';
import { COL, TangleResponse, TransactionType } from '@build-5/interfaces';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { createNftTransferData } from '../../nft/nft-transfer.service';
import { Action } from '../../transaction-service';
import { nftTangleTransferSchema } from './NftTransferTangleRequestSchema';

export class TangleNftTransferService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ request, owner, project }: HandlerParams) => {
    const params = await assertValidationAsync(nftTangleTransferSchema, request);

    const transfers = await createNftTransferData(
      this.transaction,
      project,
      owner,
      params.transfers,
    );

    for (const [nftId, { code, nftUpdateData, order }] of Object.entries(transfers)) {
      if (code !== 200) {
        continue;
      }
      if (nftUpdateData) {
        const nftDocRef = build5Db().doc(COL.NFT, nftId);
        this.transactionService.push({ ref: nftDocRef, data: nftUpdateData, action: Action.U });
      }
      if (order) {
        const tranDocRef = build5Db().doc(COL.TRANSACTION, order?.uid!);
        this.transactionService.push({ ref: tranDocRef, data: order, action: Action.C });
      }

      if (order?.type === TransactionType.WITHDRAW_NFT) {
        const collectionDocRef = build5Db().doc(COL.COLLECTION, order.payload.collection!);
        this.transactionService.push({
          ref: collectionDocRef,
          data: { total: build5Db().inc(-1) },
          action: Action.U,
        });
      }
    }

    return Object.entries(transfers).reduce(
      (acc, [key, { code }]) => ({ ...acc, [key]: code }),
      {} as { [key: string]: number },
    );
  };
}
