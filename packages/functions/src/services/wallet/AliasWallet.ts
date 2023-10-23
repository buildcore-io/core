import { Transaction } from '@build-5/interfaces';
import {
  AliasOutput,
  AliasOutputBuilderParams,
  Client,
  GovernorAddressUnlockCondition,
  Output,
  StateControllerAddressUnlockCondition,
  UTXOInput,
  Utils,
} from '@iota/sdk';
import { cloneDeep, isEmpty } from 'lodash';
import { mergeOutputs, packBasicOutput } from '../../utils/basic-output.utils';
import { createUnlock, packEssence, submitBlock } from '../../utils/block.utils';
import { createAliasOutput } from '../../utils/token-minting-utils/alias.utils';
import { MnemonicService } from './mnemonic';
import { Wallet, WalletParams } from './wallet';
import { setConsumedOutputIds } from './wallet.service';

export class AliasWallet {
  private client: Client;
  constructor(private readonly wallet: Wallet) {
    this.client = this.wallet.client;
  }

  public mintAlias = async (transaction: Transaction, params: WalletParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );
    const aliasOutput = await createAliasOutput(this.wallet, sourceAddress);
    const outputs: Output[] = [aliasOutput];

    const remainderParams = mergeOutputs(Object.values(outputsMap));
    remainderParams.amount = (
      Number(remainderParams.amount) - Number(aliasOutput.amount)
    ).toString();
    if (Number(remainderParams.amount)) {
      outputs.push(await this.client.buildBasicOutput(remainderParams));
    }
    const inputs = Object.keys(outputsMap).map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment(Object.values(outputsMap));
    const essence = await packEssence(this.wallet, inputs, inputsCommitment, outputs, params);

    await setConsumedOutputIds(sourceAddress.bech32, Object.keys(outputsMap));

    const unlock = await createUnlock(essence, sourceAddress);
    return await submitBlock(this.wallet, essence, [unlock]);
  };

  public changeAliasOwner = async (transaction: Transaction, params: WalletParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const aliasOutputs = await this.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const targetAddress = Utils.parseBech32Address(transaction.payload.targetAddress!);
    const nextAliasOutput: AliasOutputBuilderParams = cloneDeep(aliasOutput);
    nextAliasOutput.unlockConditions = [
      new StateControllerAddressUnlockCondition(targetAddress),
      new GovernorAddressUnlockCondition(targetAddress),
    ];

    const inputs = [aliasOutputId].map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment([aliasOutput]);
    const essence = await packEssence(
      this.wallet,
      inputs,
      inputsCommitment,
      [await this.client.buildAliasOutput(nextAliasOutput)],
      params,
    );

    await setConsumedOutputIds(sourceAddress.bech32, [], [], [aliasOutputId]);

    const unlock = await createUnlock(essence, sourceAddress);
    return await submitBlock(this.wallet, essence, [unlock]);
  };

  public burnAlias = async (transaction: Transaction, params: WalletParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const aliasOutputs = await this.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const remainder = await packBasicOutput(
      this.wallet,
      transaction.payload.targetAddress!,
      Number(aliasOutput.amount),
      {},
    );

    const inputs = [aliasOutputId].map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment([aliasOutput]);
    const essence = await packEssence(this.wallet, inputs, inputsCommitment, [remainder], params);

    await setConsumedOutputIds(sourceAddress.bech32, [], [], [aliasOutputId]);

    const unlock = await createUnlock(essence, sourceAddress);
    return await submitBlock(this.wallet, essence, [unlock]);
  };

  public getAliasOutputs = async (
    governorBech32: string,
    prevConsumedAliasOutputId: string[] = [],
  ) => {
    const outputIds = isEmpty(prevConsumedAliasOutputId)
      ? (await this.client.aliasOutputIds([{ governor: governorBech32 }])).items
      : prevConsumedAliasOutputId;
    const outputs = await this.client.getOutputs(outputIds);
    return outputs.reduce(
      (acc, act, i) => ({ ...acc, [outputIds[i]]: act.output as AliasOutput }),
      {} as { [key: string]: AliasOutput },
    );
  };
}
