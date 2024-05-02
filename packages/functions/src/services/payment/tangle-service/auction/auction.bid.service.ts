import { build5Db } from '@build-5/database';
import { COL, TangleResponse, TransactionPayloadType, WenError } from '@build-5/interfaces';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { auctionBidTangleSchema } from './AuctionBidTangleRequestSchema';
import { nftBidSchema } from './NftBidTangleRequestSchema';
import { createBidOrder } from './auction.bid.order';

export class TangleNftAuctionBidService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    request,
    project,
    owner,
    order: tangleOrder,
    tran,
    tranEntry,
    payment,
  }: HandlerParams) => {
    const params = await assertValidationAsync(nftBidSchema, request);

    const nftDocRef = build5Db().doc(COL.NFT, params.nft);
    const nft = await nftDocRef.get();

    const order = await createBidOrder(project, owner, nft?.auction || '');
    order.payload.tanglePuchase = true;
    order.payload.disableWithdraw = params.disableWithdraw || false;

    if (tangleOrder.network !== order.network) {
      throw invalidArgument(WenError.invalid_network);
    }

    this.transactionService.push({
      ref: build5Db().doc(COL.TRANSACTION, order.uid),
      data: order,
      action: Action.C,
    });

    this.transactionService.createUnlockTransaction(
      payment,
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );

    return {};
  };
}

export class TangleAuctionBidService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    request,
    project,
    owner,
    order: tangleOrder,
    tran,
    tranEntry,
    payment,
  }: HandlerParams) => {
    const params = await assertValidationAsync(auctionBidTangleSchema, request);

    const order = await createBidOrder(project, owner, params.auction);

    if (tangleOrder.network !== order.network) {
      throw invalidArgument(WenError.invalid_network);
    }

    this.transactionService.push({
      ref: build5Db().doc(COL.TRANSACTION, order.uid),
      data: order,
      action: Action.C,
    });

    this.transactionService.createUnlockTransaction(
      payment,
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );
    return {};
  };
}
