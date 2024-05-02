import { NativeToken, Network, Swap, SwapOutput, SwapStatus } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgSwap } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class SwapConverter implements Converter<Swap, PgSwap> {
  toPg = (swap: Swap): PgSwap => ({
    uid: swap.uid,
    project: swap.project,
    createdOn: swap.createdOn?.toDate(),
    updatedOn: swap.updatedOn?.toDate(),
    createdBy: swap.createdBy,

    recipient: swap.recipient,
    network: swap.network,
    address: swap.address,
    orderId: swap.orderId,
    nftIdsAsk: swap.nftIdsAsk,
    baseTokenAmountAsk: swap.baseTokenAmountAsk,
    nativeTokensAsk: JSON.stringify(swap.nativeTokensAsk) as any,
    status: swap.status,
    bidOutputs: JSON.stringify(swap.bidOutputs) as any,
    askOutputs: JSON.stringify(swap.askOutputs) as any,
  });

  fromPg = (pg: PgSwap): Swap =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      recipient: pg.recipient!,
      network: pg.network as Network,
      address: pg.address!,
      orderId: pg.orderId!,
      bidOutputs: pg.bidOutputs as unknown as SwapOutput[],
      nftIdsAsk: pg.nftIdsAsk!,
      baseTokenAmountAsk: pg.baseTokenAmountAsk!,
      nativeTokensAsk: pg.nativeTokensAsk as unknown as NativeToken[],
      askOutputs: pg.askOutputs as unknown as SwapOutput[],
      status: pg.status as SwapStatus,
    });
}
