import { NativeToken, Network, Timestamp, Transaction } from '@build-5/interfaces';
import {
  IAliasOutput,
  IBasicOutput,
  IFoundryOutput,
  INftOutput,
  INodeInfo,
  IOutputResponse,
  SingleNodeClient,
} from '@iota/iota.js-next';
import { Expiration } from './IotaWalletService';
import { AddressDetails, SendToManyTargets } from './wallet.service';

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
  public abstract getBalance: (addressBech32: string) => Promise<number>;
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
    output: IBasicOutput | IAliasOutput | IFoundryOutput | INftOutput,
  ) => string;
  public abstract getOutputs: (
    addressBech32: string,
    previouslyConsumedOutputIds?: string[],
    hasStorageDepositReturn?: boolean,
    hasTimelock?: boolean,
  ) => Promise<{
    [key: string]: IBasicOutput;
  }>;
  public abstract creditLocked: (credit: Transaction, params: WalletParams) => Promise<string>;
  public abstract getTransactionOutput: (
    transactionId: string,
    outputIndex: number,
  ) => Promise<IOutputResponse>;

  constructor(
    public readonly client: SingleNodeClient,
    public readonly info: INodeInfo,
    public readonly network: Network,
  ) {}
}
