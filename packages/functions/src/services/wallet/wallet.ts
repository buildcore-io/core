import {
  NativeToken,
  Network,
  SendToManyTargets,
  Timestamp,
  Transaction,
} from '@buildcore/interfaces';
import { AliasOutput, BasicOutput, Client, FoundryOutput, INodeInfo, NftOutput } from '@iota/sdk';
import { Expiration } from './IotaWalletService';
import { AddressDetails } from './wallet.service';

export interface WalletParams {
  readonly data?: string;
  readonly storageDepositSourceAddress?: string;
  readonly nativeTokens?: NativeToken[];
  readonly storageDepositReturnAddress?: string;
  readonly vestingAt?: Timestamp | null;
  readonly expiration?: Expiration;
  readonly customMetadata?: Record<string, unknown>;
  readonly tag?: string;
}

export abstract class Wallet {
  public abstract getBalance: (
    addressBech32: string,
  ) => Promise<{ amount: number; nativeTokens: { [id: string]: number } }>;
  public abstract getNewIotaAddressDetails: (saveMnemonic?: boolean) => Promise<AddressDetails>;
  public abstract getIotaAddressDetails: (mnemonic: string) => Promise<AddressDetails>;
  public abstract getAddressDetails: (bech32: string) => Promise<AddressDetails>;
  public abstract send: (
    from: AddressDetails,
    toAddress: string,
    amount: number,
    params: WalletParams,
    outputToConsume?: string | undefined,
  ) => Promise<string>;
  public abstract sendToMany: (
    from: AddressDetails,
    targets: SendToManyTargets[],
    params: WalletParams,
  ) => Promise<string>;
  public abstract bechAddressFromOutput: (
    output: BasicOutput | AliasOutput | FoundryOutput | NftOutput,
  ) => string;
  public abstract getOutputs: (
    addressBech32: string,
    previouslyConsumedOutputIds?: string[],
    hasStorageDepositReturn?: boolean,
    hasTimelock?: boolean,
  ) => Promise<{
    [key: string]: BasicOutput;
  }>;
  public abstract creditLocked: (credit: Transaction, params: WalletParams) => Promise<string>;

  constructor(
    public readonly client: Client,
    public readonly info: INodeInfo,
    public readonly nodeIndex: number,
    public readonly nodeUrl: string,
    public readonly network: Network,
  ) {}
}
