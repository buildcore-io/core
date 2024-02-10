import { build5Db } from '@build-5/database';
import { COL, TangleResponse } from '@build-5/interfaces';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { createSwapOrder } from '../../swap/swap-service';
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

    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.push({ ref: orderDocRef, data: order, action: 'set' });

    const swapDocRef = build5Db().doc(`${COL.SWAP}/${swap.uid}`);
    this.transactionService.push({ ref: swapDocRef, data: swap, action: 'set' });

    if (params.setFunded) {
      return {};
    }
    return {
      address: order.payload.targetAddress!,
      swap: swap.uid,
    };
  };
}
