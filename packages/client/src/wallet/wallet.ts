import {
  BasicOutput,
  BasicOutputBuilderParams,
  Client,
  CoinType,
  INativeToken,
  INodeInfo,
  ReferenceUnlock,
  RegularTransactionEssence,
  TaggedDataPayload,
  TransactionEssence,
  TransactionPayload,
  UTXOInput,
  UnlockConditionType,
  Utils,
  utf8ToHex,
} from '@iota/sdk';
import { isEmpty } from 'lodash';
import { OtrRequest } from '../otr/datasets/common';
import { getSecretManager } from './client';
import { AddressDetails } from './common';
import { packBasicOutput } from './output';

export class Wallet {
  constructor(
    private readonly mnemonic: string,
    private readonly client: Client,
    private readonly info: INodeInfo,
  ) {}

  public send = async (request: OtrRequest<unknown>): Promise<string> => {
    const params = {
      targetAddress: request.otrAddress,
      metadata: { request: request.metadata },
      amount: request.amount,
      nativeTokens: request.nativeToken,
      tag: request.generateTag(),
    };
    const sourceAddress = await this.getAddressDetails(this.info, this.mnemonic);

    const output = await packBasicOutput(this.client, params);

    const consumedOutputs = await this.getOutputs(this.client, sourceAddress.bech32);

    const remainder = createRemainder(
      Object.values(consumedOutputs),
      output.amount,
      params.nativeTokens,
    );

    const outputs: BasicOutput[] = [output];
    if (!isEmpty(remainder.nativeTokens) || Number(remainder.amount) > 0) {
      outputs.push(await this.client.buildBasicOutput(remainder));
    }

    const inputs = Object.keys(consumedOutputs).map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment(Object.values(consumedOutputs));

    const essence = new RegularTransactionEssence(
      await this.client.getNetworkId(),
      inputsCommitment,
      inputs,
      outputs,
      new TaggedDataPayload(utf8ToHex(params.tag), ''),
    );

    const fromUnlock = await createUnlock(essence, sourceAddress);
    const unlocks = Object.values(consumedOutputs).map((_, i) =>
      i ? new ReferenceUnlock(0) : fromUnlock,
    );

    return (await this.client.postBlockPayload(new TransactionPayload(essence, unlocks)))[0];
  };

  private getAddressDetails = async (
    info: INodeInfo,
    mnemonic: string,
  ): Promise<AddressDetails> => {
    const secretManager = getSecretManager(mnemonic);
    const addresses = await secretManager.generateEd25519Addresses({
      coinType: CoinType.IOTA,
      range: { start: 0, end: 1 },
      bech32Hrp: info.protocol.bech32Hrp,
    });

    const hex = Utils.bech32ToHex(addresses[0]);
    return { mnemonic, hex, bech32: addresses[0] };
  };

  private getOutputs = async (
    client: Client,
    addressBech32: string,
  ): Promise<{ [key: string]: BasicOutput }> => {
    const query = [
      { address: addressBech32 },
      { hasStorageDepositReturn: false },
      { hasTimelock: false },
    ];
    const outputIds = (await client.basicOutputIds(query)).items;
    const outputs = await client.getOutputs(outputIds);
    return outputs.reduce(
      (acc, act, i) => ({ ...acc, [outputIds[i]]: act.output as BasicOutput }),
      {},
    );
  };
}

const createRemainder = (outputs: BasicOutput[], amount: string, nativeToken?: INativeToken) => {
  const addressUnlock = outputs[0].unlockConditions.find(
    (u) => u.type === UnlockConditionType.Address,
  )!;

  const remainder: BasicOutputBuilderParams = {
    amount: -BigInt(amount),
    unlockConditions: [addressUnlock],
    nativeTokens: nativeToken ? [{ amount: -nativeToken.amount, id: nativeToken.id }] : [],
  };

  for (const output of outputs) {
    const nativeTokens = remainder.nativeTokens || [];
    for (const nativeToken of output.nativeTokens || []) {
      const index = nativeTokens.findIndex((n) => n.id === nativeToken.id);
      if (index === -1) {
        nativeTokens.push(nativeToken);
      } else {
        nativeTokens[index].amount =
          BigInt(nativeTokens[index].amount) + BigInt(nativeToken.amount);
      }
    }
    remainder.amount = BigInt(output.amount) + BigInt(remainder.amount!);
    remainder.nativeTokens = nativeTokens;
  }

  return remainder;
};

const createUnlock = async (essence: TransactionEssence, address: AddressDetails) => {
  const essenceHash = Utils.hashTransactionEssence(essence);
  const secretManager = getSecretManager(address.mnemonic);
  return await secretManager.signatureUnlock(essenceHash, { coinType: CoinType.IOTA });
};
