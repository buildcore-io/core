import {
  Bech32Helper,
  GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE,
  IAliasOutput,
  IndexerPluginClient,
  STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE,
  TransactionHelper,
} from '@iota/iota.js-next';
import { Transaction } from '@soonaverse/interfaces';
import { cloneDeep, isEmpty } from 'lodash';
import { mergeOutputs, packBasicOutput } from '../../../utils/basic-output.utils';
import { packEssence, packPayload, submitBlock } from '../../../utils/block.utils';
import { createUnlock } from '../../../utils/smr.utils';
import { createAliasOutput } from '../../../utils/token-minting-utils/alias.utils';
import { MnemonicService } from '../mnemonic';
import { SmrParams, SmrWallet } from '../SmrWalletService';
import { setConsumedOutputIds } from '../wallet';

export class AliasWallet {
  constructor(private readonly wallet: SmrWallet) {}

  public mintAlias = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );
    const remainder = mergeOutputs(Object.values(outputsMap));
    const aliasOutput = createAliasOutput(sourceAddress, this.wallet.info);
    remainder.amount = (Number(remainder.amount) - Number(aliasOutput.amount)).toString();

    const inputs = Object.keys(outputsMap).map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(outputsMap));
    const essence = packEssence(
      inputs,
      inputsCommitment,
      Number(remainder.amount) ? [aliasOutput, remainder] : [aliasOutput],
      this.wallet,
      params,
    );

    await setConsumedOutputIds(sourceAddress.bech32, Object.keys(outputsMap));
    return await submitBlock(
      this.wallet,
      packPayload(essence, [createUnlock(essence, sourceAddress.keyPair)]),
    );
  };

  public changeAliasOwner = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const aliasOutputs = await this.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const targetAddress = Bech32Helper.addressFromBech32(
      transaction.payload.targetAddress,
      this.wallet.info.protocol.bech32Hrp,
    );
    const nextAliasOutput = cloneDeep(aliasOutput);
    nextAliasOutput.unlockConditions = [
      { type: STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress },
      { type: GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress },
    ];

    const inputs = [aliasOutputId].map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment([aliasOutput]);
    const essence = packEssence(inputs, inputsCommitment, [nextAliasOutput], this.wallet, params);

    await setConsumedOutputIds(sourceAddress.bech32, [], [], [aliasOutputId]);
    return await submitBlock(
      this.wallet,
      packPayload(essence, [createUnlock(essence, sourceAddress.keyPair)]),
    );
  };

  public burnAlias = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const aliasOutputs = await this.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const remainder = packBasicOutput(
      transaction.payload.targetAddress,
      Number(aliasOutput.amount),
      [],
      this.wallet.info,
    );

    const inputs = [aliasOutputId].map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment([aliasOutput]);
    const essence = packEssence(inputs, inputsCommitment, [remainder], this.wallet, params);

    await setConsumedOutputIds(sourceAddress.bech32, [], [], [aliasOutputId]);
    return await submitBlock(
      this.wallet,
      packPayload(essence, [createUnlock(essence, sourceAddress.keyPair)]),
    );
  };

  public getAliasOutputs = async (
    governorBech32: string,
    prevConsumedAliasOutputId: string[] = [],
  ) => {
    const indexer = new IndexerPluginClient(this.wallet.client);
    const outputIds = isEmpty(prevConsumedAliasOutputId)
      ? (await indexer.aliases({ governorBech32 })).items
      : prevConsumedAliasOutputId;
    const outputs: { [key: string]: IAliasOutput } = {};
    for (const id of outputIds) {
      const output = (await this.wallet.client.output(id)).output;
      outputs[id] = output as IAliasOutput;
    }
    return outputs;
  };
}
