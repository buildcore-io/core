import { NativeToken, NetworkAddress, Timestamp, Transaction } from '@build-5/interfaces';
import {
  AddressUnlockCondition,
  AliasOutput,
  BasicOutput,
  BasicOutputBuilderParams,
  CoinType,
  CommonOutput,
  FoundryOutput,
  NftOutput,
  NftOutputBuilderParams,
  OutputType,
  QueryParameter,
  ReferenceUnlock,
  UTXOInput,
  Unlock,
  Utils,
} from '@iota/sdk';
import { cloneDeep, head, isEmpty } from 'lodash';
import { mergeOutputs, packBasicOutput } from '../../utils/basic-output.utils';
import { Bech32AddressHelper } from '../../utils/bech32-address.helper';
import { createUnlock, packEssence, submitBlock } from '../../utils/block.utils';
import { getSecretManager } from '../../utils/secret.manager.utils';
import { NftWallet } from './NftWallet';
import { MnemonicService } from './mnemonic';
import { Wallet, WalletParams } from './wallet';
import { AddressDetails, SendToManyTargets, setConsumedOutputIds } from './wallet.service';

export interface Expiration {
  readonly expiresAt: Timestamp;
  readonly returnAddressBech32: string;
}

export class IotaWallet extends Wallet {
  public getBalance = async (addressBech32: string) => {
    const outputIds = (
      await this.client.basicOutputIds([{ address: addressBech32 }, { hasTimelock: false }])
    ).items;
    const outputs = await this.client.getOutputs(outputIds);
    let totalAmount = BigInt(0);
    const totalNativeTokens: { [id: string]: number } = {};
    for (const outputResponse of outputs) {
      const output = outputResponse.output;
      if (output instanceof CommonOutput) {
        (output as CommonOutput).getNativeTokens()?.forEach((token) => {
          totalNativeTokens[token.id] = (totalNativeTokens[token.id] || 0) + Number(token.amount);
        });
      }
      totalAmount += output.getAmount();
    }
    return { amount: Number(totalAmount), nativeTokens: totalNativeTokens };
  };

  public getNewIotaAddressDetails = async (saveMnemonic = true) => {
    const address = await this.getIotaAddressDetails(Utils.generateMnemonic());
    saveMnemonic && (await MnemonicService.store(address.bech32, address.mnemonic, this.network));
    return address;
  };

  public getIotaAddressDetails = async (mnemonic: string): Promise<AddressDetails> => {
    const secretManager = getSecretManager(mnemonic);
    const addresses = await secretManager.generateEd25519Addresses({
      coinType: CoinType.IOTA,
      range: { start: 0, end: 1 },
      bech32Hrp: this.info.protocol.bech32Hrp,
    });

    const hex = Utils.bech32ToHex(addresses[0]);
    return { mnemonic, hex, bech32: addresses[0] };
  };

  public getAddressDetails = async (bech32: string | undefined) => {
    const mnemonic = await MnemonicService.get(bech32 || '');
    return this.getIotaAddressDetails(mnemonic);
  };

  public bechAddressFromOutput = (
    output: BasicOutput | AliasOutput | FoundryOutput | NftOutput,
  ) => {
    const hrp = this.info.protocol.bech32Hrp!;
    return Bech32AddressHelper.bech32FromUnlockConditions(output, hrp);
  };

  public getOutputs = async (
    addressBech32: string,
    previouslyConsumedOutputIds: string[] = [],
    hasStorageDepositReturn: boolean | undefined,
    hasTimelock = false,
  ) => {
    const query: QueryParameter[] = [{ address: addressBech32 }, { hasTimelock }];
    if (hasStorageDepositReturn !== undefined) {
      query.push({ hasStorageDepositReturn });
    }
    const outputIds = isEmpty(previouslyConsumedOutputIds)
      ? (await this.client.basicOutputIds(query)).items
      : previouslyConsumedOutputIds;

    const outputs = await this.client.getOutputs(outputIds);
    return outputs.reduce((acc, act, i) => {
      if (act.output.type === OutputType.Basic) {
        return { ...acc, [outputIds[i]]: act.output as BasicOutput };
      }
      return acc;
    }, {} as { [key: string]: BasicOutput });
  };

  public send = async (
    from: AddressDetails,
    toAddress: NetworkAddress,
    amount: number,
    params: WalletParams,
    outputToConsume?: string | undefined,
  ): Promise<string> => {
    const prevConsumedOutputIds = outputToConsume
      ? [outputToConsume]
      : (await MnemonicService.getData(from.bech32)).consumedOutputIds;
    const outputsMap = await this.getOutputs(from.bech32, prevConsumedOutputIds, false);
    const consumedOutpus = Object.values(outputsMap);
    const output = await packBasicOutput(this, toAddress, amount, params);

    const remainders: BasicOutput[] = [];

    let storageDepositOutputMap: { [key: string]: BasicOutput } = {};
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
        remainders.push(await this.client.buildBasicOutput(remainder));
      }
    }
    const remainder = mergeOutputs(cloneDeep(consumedOutpus));
    remainder.nativeTokens = subtractNativeTokens(remainder, params.nativeTokens);
    if (!params.storageDepositSourceAddress) {
      remainder.amount = (Number(remainder.amount) - Number(output.amount)).toString();
    }
    if (!isEmpty(remainder.nativeTokens) || Number(remainder.amount) > 0) {
      remainders.push(await this.client.buildBasicOutput(remainder));
    }

    const inputs = [...Object.keys(outputsMap), ...Object.keys(storageDepositOutputMap)].map(
      UTXOInput.fromOutputId,
    );
    const inputsCommitment = Utils.computeInputsCommitment([
      ...consumedOutpus,
      ...Object.values(storageDepositOutputMap),
    ]);

    const essence = await packEssence(
      this,
      inputs,
      inputsCommitment,
      [output, ...remainders],
      params,
    );
    const fromUnlock = await createUnlock(essence, from);
    const unlocks: Unlock[] = consumedOutpus.map((_, i) =>
      i ? new ReferenceUnlock(0) : fromUnlock,
    );
    if (params.storageDepositSourceAddress) {
      const address = await this.getAddressDetails(params.storageDepositSourceAddress);
      const storageDepUnlock = await createUnlock(essence, address);
      const storageDepUnlocks: Unlock[] = Object.values(storageDepositOutputMap).map((_, index) =>
        index ? new ReferenceUnlock(unlocks.length) : storageDepUnlock,
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
    return await submitBlock(this, essence, unlocks);
  };

  public sendToMany = async (
    from: AddressDetails,
    targets: SendToManyTargets[],
    params: WalletParams,
  ): Promise<string> => {
    const outputsMap = await this.getOutputs(from.bech32, [], false);
    const mergedConsumedOutputs = mergeOutputs(Object.values(cloneDeep(outputsMap)));

    const promises = targets.map((target) =>
      packBasicOutput(this, target.toAddress, target.amount, {
        nativeTokens: target.nativeTokens,
        customMetadata: target.customMetadata,
      }),
    );
    const outputs = await Promise.all(promises);
    const mergedOutputs = mergeOutputs(Object.values(cloneDeep(outputs)));

    const remainderAmount = Number(mergedConsumedOutputs.amount) - Number(mergedOutputs.amount);
    const remainderNativeTokenAmount =
      Number(head(mergedConsumedOutputs.nativeTokens)?.amount || 0) -
      Number(head(mergedOutputs.nativeTokens)?.amount || 0);

    const remainderNativeTokens = remainderNativeTokenAmount
      ? [
          {
            id: mergedConsumedOutputs.nativeTokens![0].id,
            amount: BigInt(remainderNativeTokenAmount),
          },
        ]
      : [];

    const remainder = await packBasicOutput(this, from.bech32, remainderAmount, {
      nativeTokens: remainderNativeTokens,
    });

    const inputs = Object.keys(outputsMap).map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment(Object.values(outputsMap));

    const essence = await packEssence(
      this,
      inputs,
      inputsCommitment,
      remainderAmount > 0 ? [...outputs, remainder] : outputs,
      params,
    );
    const fromUnlock = await createUnlock(essence, from);
    const unlocks: Unlock[] = Object.values(outputsMap).map((_, index) =>
      index ? new ReferenceUnlock(0) : fromUnlock,
    );
    await setConsumedOutputIds(from.bech32, Object.keys(outputsMap));
    return await submitBlock(this, essence, unlocks);
  };

  public creditLocked = async (credit: Transaction, params: WalletParams): Promise<string> => {
    const mnemonicData = await MnemonicService.getData(credit.payload.sourceAddress!);
    const prevSourceConsumedOutputIds = mnemonicData.consumedOutputIds || [];
    const sourceConsumedOutputs = await this.getOutputs(
      credit.payload.sourceAddress!,
      prevSourceConsumedOutputIds,
      true,
    );

    const sourceBasicOutputsPromises = Object.values(sourceConsumedOutputs).map((o) =>
      packBasicOutput(this, credit.payload.targetAddress!, Number(o.amount), {
        nativeTokens: o.nativeTokens,
      }),
    );
    const sourceBasicOutputs = await Promise.all(sourceBasicOutputsPromises);

    const nftWallet = new NftWallet(this);
    const sourceConsumedNftOutputs = await nftWallet.getNftOutputs(
      undefined,
      credit.payload.sourceAddress,
      mnemonicData.consumedNftOutputIds,
    );
    const targetAddress = Utils.parseBech32Address(credit.payload.targetAddress!);
    const sourceNftOutputsPromises = Object.values(sourceConsumedNftOutputs).map((nftOutput) => {
      const output: NftOutputBuilderParams = cloneDeep(nftOutput);
      output.unlockConditions = [new AddressUnlockCondition(targetAddress)];
      return this.client.buildNftOutput(output);
    });
    const sourceNftOutputs = await Promise.all(sourceNftOutputsPromises);
    const sourceOutputs = [...sourceBasicOutputs, ...sourceNftOutputs];

    const prevStorageDepConsumedOutputIds =
      (await MnemonicService.getData(credit.payload.storageDepositSourceAddress!))
        .consumedOutputIds || [];
    const storageDepConsumedOutputs = await this.getOutputs(
      credit.payload.storageDepositSourceAddress!,
      prevStorageDepConsumedOutputIds,
      false,
    );
    const storageDepOutputsPromises = Object.values(storageDepConsumedOutputs).map((o) =>
      packBasicOutput(this, credit.payload.targetAddress!, Number(o.amount), {
        nativeTokens: o.nativeTokens,
      }),
    );
    const storageDepOutputs = await Promise.all(storageDepOutputsPromises);

    const inputs = [
      ...Object.keys(sourceConsumedOutputs),
      ...Object.keys(sourceConsumedNftOutputs),
      ...Object.keys(storageDepConsumedOutputs),
    ].map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment([
      ...Object.values(sourceConsumedOutputs),
      ...Object.values(sourceConsumedNftOutputs),
      ...Object.values(storageDepConsumedOutputs),
    ]);

    const essence = await packEssence(
      this,
      inputs,
      inputsCommitment,
      [...sourceOutputs, ...storageDepOutputs],
      params,
    );

    const sourceAddress = await this.getAddressDetails(credit.payload.sourceAddress);
    const storageDepositAddess = await this.getAddressDetails(
      credit.payload.storageDepositSourceAddress,
    );

    const sourceAddressUnlock = await createUnlock(essence, sourceAddress);
    const sourceUnlocks: Unlock[] = Object.keys(sourceOutputs).map((_, i) =>
      i ? new ReferenceUnlock(0) : sourceAddressUnlock,
    );
    const storageDepositUnlock = await createUnlock(essence, storageDepositAddess);
    const storageDepositUnlocks: Unlock[] = Object.keys(storageDepConsumedOutputs).map((_, i) =>
      i ? new ReferenceUnlock(sourceUnlocks.length) : storageDepositUnlock,
    );
    await setConsumedOutputIds(
      sourceAddress.bech32,
      Object.keys(sourceConsumedOutputs),
      Object.keys(sourceConsumedNftOutputs),
    );
    await setConsumedOutputIds(storageDepositAddess.bech32, Object.keys(storageDepConsumedOutputs));
    return await submitBlock(this, essence, [...sourceUnlocks, ...storageDepositUnlocks]);
  };
}

const subtractNativeTokens = (
  output: BasicOutput | BasicOutputBuilderParams,
  tokens: NativeToken[] | undefined,
) => {
  if (!output.nativeTokens || !tokens) {
    return output.nativeTokens;
  }
  return cloneDeep(output.nativeTokens || [])
    .map((token) => {
      const tokenToSubtract = tokens.find((t) => t.id === token.id)?.amount;
      if (!tokenToSubtract) {
        return token;
      }
      return { id: token.id, amount: BigInt(token.amount) - tokenToSubtract };
    })
    .filter((nt) => Number(nt.amount) !== 0);
};
