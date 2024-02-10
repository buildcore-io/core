import { BaseRecord, NetworkAddress } from './base';
import { NativeToken } from './milestone';
import { Network } from './transaction';

export enum SwapStatus {
  DRAFT = 'draft',
  FUNDED = 'funded',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
}

export interface SwapOutput {
  readonly amount: number;
  readonly nativeTokens?: NativeToken[];
  readonly nftId?: string;
  readonly outputId: string;
  readonly fromAddress: string;
  readonly payment: string;
}

export interface Swap extends BaseRecord {
  readonly recipient: string;
  readonly network: Network;
  readonly address: NetworkAddress;
  readonly orderId: string;

  readonly bidOutputs?: SwapOutput[];

  readonly nftIdsAsk: string[];
  readonly baseTokenAmountAsk: number;
  readonly nativeTokensAsk: NativeToken[];

  readonly askOutputs?: SwapOutput[];

  readonly status: SwapStatus;
}
