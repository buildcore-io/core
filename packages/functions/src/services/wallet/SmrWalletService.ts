import { Bip32Path } from '@iota/crypto.js-next';
import {
  addressBalance,
  BASIC_OUTPUT_TYPE,
  Bech32Helper,
  Ed25519Address,
  Ed25519Seed,
  ED25519_ADDRESS_TYPE,
  IAliasOutput,
  IBasicOutput,
  IFoundryOutput,
  IndexerPluginClient,
  INftOutput,
  INodeInfo,
  REFERENCE_UNLOCK_TYPE,
  SingleNodeClient,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import { NativeToken, Network, Timestamp, Transaction } from '@soonaverse/interfaces';
import { generateMnemonic } from 'bip39';
import * as functions from 'firebase-functions';
import { cloneDeep, isEmpty } from 'lodash';
import { mergeOutputs, packBasicOutput, subtractHex } from '../../utils/basic-output.utils';
import { Bech32AddressHelper } from '../../utils/bech32-address.helper';
import { packEssence, packPayload, submitBlock } from '../../utils/block.utils';
import { getRandomElement } from '../../utils/common.utils';
import { createUnlock } from '../../utils/smr.utils';
import { MnemonicService } from './mnemonic';
import { AddressDetails, setConsumedOutputIds, Wallet, WalletParams } from './wallet';

const RMS_API_ENDPOINTS = ['https://rms1.svrs.io/'];
const SMR_API_ENDPOINTS = ['https://smr1.svrs.io/', 'https://smr3.svrs.io/'];

export const getEndpointUrl = (network: Network) => {
  const urls = network === Network.SMR ? SMR_API_ENDPOINTS : RMS_API_ENDPOINTS;
  return getRandomElement(urls);
};

export interface Expiration {
  readonly expiresAt: Timestamp;
  readonly returnAddressBech32: string;
}

export interface SmrParams extends WalletParams {
  readonly storageDepositSourceAddress?: string;
  readonly nativeTokens?: NativeToken[];
  readonly storageDepositReturnAddress?: string;
  readonly vestingAt?: Timestamp;
  readonly expiration?: Expiration;
  readonly customMetadata?: Record<string, unknown>;
}

export const getShimmerClient = async (network: Network) => {
  let url = '';
  for (let i = 0; i < 5; ++i) {
    url = getEndpointUrl(network);
    try {
      const client = new SingleNodeClient(url);
      const healty = await client.health();
      if (healty) {
        return { client, info: await client.info() };
      }
    } catch (error) {
      functions.logger.warn(`Could not connect to client ${network}`, url, error);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 1000 + 500)));
  }
  functions.logger.error(`Could not connect to client ${network}`, url);
  throw Error(`Could not connect to any client ${network}`);
};

export class SmrWallet implements Wallet<SmrParams> {
  constructor(
    public readonly client: SingleNodeClient,
    public readonly info: INodeInfo,
    private readonly network: Network,
  ) {}

  public getBalance = async (addressBech32: string) => {
    const balance = await addressBalance(this.client, addressBech32);
    return Number(balance.balance);
  };

  public getNewIotaAddressDetails = async (saveMnemonic = true) => {
    const address = await this.getIotaAddressDetails(generateMnemonic() + ' ' + generateMnemonic());
    saveMnemonic && (await MnemonicService.store(address.bech32, address.mnemonic, this.network));
    return address;
  };

  public getIotaAddressDetails = async (mnemonic: string): Promise<AddressDetails> => {
    const walletSeed = Ed25519Seed.fromMnemonic(mnemonic);
    const walletPath = new Bip32Path("m/44'/4218'/0'/0'/0'");
    const walletAddressSeed = walletSeed.generateSeedFromPath(walletPath);
    const keyPair = walletAddressSeed.keyPair();
    const walletEd25519Address = new Ed25519Address(keyPair.publicKey);
    const walletAddress = walletEd25519Address.toAddress();
    const hex = Converter.bytesToHex(walletAddress, true);
    const bech32 = Bech32Helper.toBech32(
      ED25519_ADDRESS_TYPE,
      walletAddress,
      this.info.protocol.bech32Hrp,
    );

    return { mnemonic, keyPair, hex, bech32 };
  };

  public getAddressDetails = async (bech32: string) => {
    const mnemonic = await MnemonicService.get(bech32);
    return this.getIotaAddressDetails(mnemonic);
  };

  public getTransactionOutput = async (transactionId: string, outputIndex: number) => {
    const outputId = TransactionHelper.outputIdFromTransactionData(transactionId, outputIndex);
    return await this.client.output(outputId);
  };

  public bechAddressFromOutput = async (
    output: IBasicOutput | IAliasOutput | IFoundryOutput | INftOutput,
  ) => {
    const hrp = this.info.protocol.bech32Hrp!;
    return Bech32AddressHelper.addressFromAddressUnlockCondition(
      output.unlockConditions,
      hrp,
      output.type,
    );
  };

  public getOutputs = async (
    addressBech32: string,
    previouslyConsumedOutputIds: string[] = [],
    hasStorageDepositReturn: boolean | undefined,
    hasTimelock = false,
  ) => {
    const indexer = new IndexerPluginClient(this.client);
    const query = {
      addressBech32,
      hasStorageDepositReturn,
      hasTimelock,
    };
    const outputIds = isEmpty(previouslyConsumedOutputIds)
      ? (await indexer.basicOutputs(query)).items
      : previouslyConsumedOutputIds;
    const outputs: { [key: string]: IBasicOutput } = {};
    for (const id of outputIds) {
      const output = (await this.client.output(id)).output;
      if (output.type === BASIC_OUTPUT_TYPE) {
        outputs[id] = output;
      }
    }
    return outputs;
  };

  public send = async (
    from: AddressDetails,
    toBech32: string,
    amount: number,
    params: SmrParams,
    outputToConsume?: string,
  ) => {
    const prevConsumedOutputIds = outputToConsume
      ? [outputToConsume]
      : (await MnemonicService.getData(from.bech32)).consumedOutputIds;
    const outputsMap = await this.getOutputs(from.bech32, prevConsumedOutputIds, false);
    const output = packBasicOutput(
      toBech32,
      amount,
      params.nativeTokens,
      this.info,
      params.storageDepositReturnAddress,
      params.vestingAt,
      params.expiration,
      params.customMetadata,
    );

    const remainders: IBasicOutput[] = [];

    let storageDepositOutputMap: { [key: string]: IBasicOutput } = {};
    if (params.storageDepositSourceAddress) {
      const previouslyConsumedOutputIds =
        (await MnemonicService.getData(params.storageDepositSourceAddress)).consumedOutputIds || [];
      storageDepositOutputMap = await this.getOutputs(
        params.storageDepositSourceAddress,
        previouslyConsumedOutputIds,
        false,
      );
      const remainder = mergeOutputs(cloneDeep(Object.values(storageDepositOutputMap)));
      remainder.amount = (Number(remainder.amount) - Number(output.amount)).toString();
      if (Number(remainder.amount)) {
        remainders.push(remainder);
      }
    }
    const remainder = mergeOutputs(cloneDeep(Object.values(outputsMap)));
    remainder.nativeTokens = subtractNativeTokens(remainder, params.nativeTokens);
    if (!params.storageDepositSourceAddress) {
      remainder.amount = (Number(remainder.amount) - Number(output.amount)).toString();
    }
    if (!isEmpty(remainder.nativeTokens) || Number(remainder.amount) > 0) {
      remainders.push(remainder);
    }

    const inputs = [...Object.keys(outputsMap), ...Object.keys(storageDepositOutputMap)].map(
      TransactionHelper.inputFromOutputId,
    );
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      ...Object.values(outputsMap),
      ...Object.values(storageDepositOutputMap),
    ]);

    const essence = packEssence(inputs, inputsCommitment, [output, ...remainders], this, params);
    const unlocks: UnlockTypes[] = Object.values(outputsMap).map((_, index) =>
      !index ? createUnlock(essence, from.keyPair) : { type: REFERENCE_UNLOCK_TYPE, reference: 0 },
    );
    if (params.storageDepositSourceAddress) {
      const address = await this.getAddressDetails(params.storageDepositSourceAddress);
      const storageDepUnlocks: UnlockTypes[] = Object.values(storageDepositOutputMap).map(
        (_, index) =>
          !index
            ? createUnlock(essence, address.keyPair)
            : { type: REFERENCE_UNLOCK_TYPE, reference: unlocks.length },
      );
      unlocks.push(...storageDepUnlocks);
    }

    if (!outputToConsume) {
      await setConsumedOutputIds(from.bech32, Object.keys(outputsMap));
      if (params.storageDepositSourceAddress) {
        await setConsumedOutputIds(
          params.storageDepositSourceAddress,
          Object.keys(storageDepositOutputMap),
        );
      }
    }
    return await submitBlock(this, packPayload(essence, unlocks));
  };

  public sendToMany = async (
    from: AddressDetails,
    targets: {
      toAddress: string;
      amount: number;
      customMetadata?: Record<string, unknown>;
    }[],
    params: SmrParams,
  ) => {
    const prevConsumedOutputIds =
      (await MnemonicService.getData(from.bech32)).consumedOutputIds || [];
    const outputsMap = await this.getOutputs(from.bech32, prevConsumedOutputIds, false);
    const total = Object.values(outputsMap).reduce((acc, act) => acc + Number(act.amount), 0);

    const outputs = targets.map((target) =>
      packBasicOutput(
        target.toAddress,
        target.amount,
        params.nativeTokens,
        this.info,
        params.storageDepositReturnAddress,
        params.vestingAt,
        undefined,
        target.customMetadata,
      ),
    );
    const outputsTotal = outputs.reduce((acc, act) => acc + Number(act.amount), 0);

    const remainderAmount = total - outputsTotal;
    const remainder =
      remainderAmount > 0
        ? packBasicOutput(from.bech32, remainderAmount, [], this.info)
        : undefined;

    const inputs = Object.keys(outputsMap).map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(outputsMap));

    const essence = packEssence(
      inputs,
      inputsCommitment,
      remainder ? [...outputs, remainder] : outputs,
      this,
      params,
    );
    const unlocks: UnlockTypes[] = Object.values(outputsMap).map((_, index) =>
      !index ? createUnlock(essence, from.keyPair) : { type: REFERENCE_UNLOCK_TYPE, reference: 0 },
    );
    await setConsumedOutputIds(from.bech32, Object.keys(outputsMap));
    return await submitBlock(this, packPayload(essence, unlocks));
  };

  public creditLocked = async (credit: Transaction, params: SmrParams) => {
    const prevSourceConsumedOutputIds =
      (await MnemonicService.getData(credit.payload.sourceAddress)).consumedOutputIds || [];
    const sourceConsumedOutputs = await this.getOutputs(
      credit.payload.sourceAddress,
      prevSourceConsumedOutputIds,
      true,
    );
    const sourceOutputs = Object.values(sourceConsumedOutputs).map((o) =>
      packBasicOutput(credit.payload.targetAddress, Number(o.amount), o.nativeTokens, this.info),
    );

    const prevStorageDepConsumedOutputIds =
      (await MnemonicService.getData(credit.payload.storageDepositSourceAddress))
        .consumedOutputIds || [];
    const storageDepConsumedOutputs = await this.getOutputs(
      credit.payload.storageDepositSourceAddress,
      prevStorageDepConsumedOutputIds,
      false,
    );
    const storageDepOutputs = Object.values(storageDepConsumedOutputs).map((o) =>
      packBasicOutput(credit.payload.targetAddress, Number(o.amount), o.nativeTokens, this.info),
    );

    const inputs = [
      ...Object.keys(sourceConsumedOutputs),
      ...Object.keys(storageDepConsumedOutputs),
    ].map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      ...Object.values(sourceConsumedOutputs),
      ...Object.values(storageDepConsumedOutputs),
    ]);

    const essence = packEssence(
      inputs,
      inputsCommitment,
      [...sourceOutputs, ...storageDepOutputs],
      this,
      params,
    );

    const sourceAddress = await this.getAddressDetails(credit.payload.sourceAddress);
    const storageDepositAddess = await this.getAddressDetails(
      credit.payload.storageDepositSourceAddress,
    );

    const sourceUnlocks: UnlockTypes[] = Object.keys(sourceConsumedOutputs).map((_, i) =>
      i
        ? { type: REFERENCE_UNLOCK_TYPE, reference: 0 }
        : createUnlock(essence, sourceAddress.keyPair),
    );
    const storageDepositUnlocks: UnlockTypes[] = Object.keys(storageDepConsumedOutputs).map(
      (_, i) =>
        i
          ? { type: REFERENCE_UNLOCK_TYPE, reference: sourceUnlocks.length }
          : createUnlock(essence, storageDepositAddess.keyPair),
    );
    await setConsumedOutputIds(sourceAddress.bech32, Object.keys(sourceConsumedOutputs));
    await setConsumedOutputIds(storageDepositAddess.bech32, Object.keys(storageDepConsumedOutputs));
    return await submitBlock(
      this,
      packPayload(essence, [...sourceUnlocks, ...storageDepositUnlocks]),
    );
  };
}

const subtractNativeTokens = (output: IBasicOutput, tokens: NativeToken[] | undefined) => {
  if (!output.nativeTokens || !tokens) {
    return output.nativeTokens;
  }
  return cloneDeep(output.nativeTokens || [])
    .map((token) => {
      const tokenToSubtract = tokens.find((t) => t.id === token.id)?.amount;
      if (!tokenToSubtract) {
        return token;
      }
      return { id: token.id, amount: subtractHex(token.amount, tokenToSubtract) };
    })
    .filter((nt) => Number(nt.amount) !== 0);
};
