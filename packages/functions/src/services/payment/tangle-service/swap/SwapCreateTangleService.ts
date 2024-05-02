import { database } from '@buildcore/database';
import { COL, TangleResponse } from '@buildcore/interfaces';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { createSwapOrder } from '../../swap/swap-service';
import { Action } from '../../transaction-service';
import { swapCreateTangleSchema } from './SwapCreateTangleRequestSchema';

export class SwapCreateTangleService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
    order: tangleOrder,
    match,
    payment,
  }: HandlerParams): Promise<TangleResponse> => {
    const params = await assertValidationAsync(swapCreateTangleSchema, request);

    const wallet = await WalletService.newWallet(tangleOrder.network);
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const bids = params.setFunded
      ? [
          {
            amount: match.to.amount,
            nftId: match.to.nftOutput?.nftId || '',
            nativeTokens: match.to.nativeTokens || [],
            outputId: match.to.outputId!,
            fromAddress: match.from,
            payment: payment?.uid || '',
          },
        ]
      : [];

    const { order, swap } = await createSwapOrder(
      wallet,
      project,
      owner,
      tangleOrder.network,
      targetAddress.bech32,
      params,
      bids,
    );

    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    this.transactionService.push({ ref: orderDocRef, data: order, action: Action.C });

    const swapDocRef = database().doc(COL.SWAP, swap.uid);
    this.transactionService.push({ ref: swapDocRef, data: swap, action: Action.C });

    if (params.setFunded) {
      return {};
    }
    return {
      address: order.payload.targetAddress!,
      swap: swap.uid,
    };
  };
}
