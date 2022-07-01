import { AddressTypes, ALIAS_OUTPUT_TYPE, ED25519_ADDRESS_TYPE, GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE, IAliasOutput, IKeyPair, IndexerPluginClient, ISSUER_FEATURE_TYPE, ITransactionPayload, METADATA_FEATURE_TYPE, OutputTypes, SingleNodeClient, STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE, TransactionHelper } from "@iota/iota.js-next";
import { Converter } from "@iota/util.js-next";
import { cloneDeep } from "lodash";
import { AddressDetails } from "../wallet";
import { createPayload } from "./common.utils";

export const createAliasOutput = (amount: number, ownerAddressHex: string, metadata = 'no-metadata'): IAliasOutput => {
  const address: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: ownerAddressHex }
  return {
    type: ALIAS_OUTPUT_TYPE,
    amount: amount.toString(),
    aliasId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    stateIndex: 0,
    foundryCounter: 0,
    immutableFeatures: [
      { type: ISSUER_FEATURE_TYPE, address },
      { type: METADATA_FEATURE_TYPE, data: Converter.utf8ToHex(metadata, true) }
    ],
    unlockConditions: [
      { type: STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE, address },
      { type: GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE, address }
    ]
  }
}

export const createAlias = async (client: SingleNodeClient, networkId: string, address: AddressDetails): Promise<ITransactionPayload> => {
  const consumedOutputId = await fetchAndWaitForBasicOutput(client, address.bech32);
  const consumedOutput = (await client.output(consumedOutputId)).output;

  const aliasOutput = createAliasOutput(Number(consumedOutput.amount), address.hex)
  const input = TransactionHelper.inputFromOutputId(consumedOutputId)
  const inputsCommitment = TransactionHelper.getInputsCommitment([consumedOutput])

  return createPayload(networkId, [input], [aliasOutput], inputsCommitment, address.keyPair)
}

const fetchAndWaitForBasicOutput = async (client: SingleNodeClient, addressBech32: string,): Promise<string> => {
  const indexerPluginClient = new IndexerPluginClient(client!);
  for (let i = 0; i < 10; ++i) {
    const outputsResponse = await indexerPluginClient.outputs({
      addressBech32,
      hasStorageReturnCondition: false,
      hasExpirationCondition: false,
      hasTimelockCondition: false,
      hasNativeTokens: false
    });
    if (outputsResponse.items.length) {
      return outputsResponse.items[0]
    }
    await new Promise(f => setTimeout(f, 5000));
  }
  throw new Error("Didn't find any outputs for address: " + addressBech32);
};

export const transferAlias = (
  consumedOutput: OutputTypes,
  consumedOutputId: string,
  walletKeyPair: IKeyPair,
  targetAddress: AddressTypes,
  networkId: string
): ITransactionPayload => {
  const prevAliasInput = TransactionHelper.inputFromOutputId(consumedOutputId);
  const nextAlias = cloneDeep(consumedOutput) as IAliasOutput;
  nextAlias.unlockConditions = [
    {
      type: STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE,
      address: targetAddress
    },
    {
      type: GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE,
      address: targetAddress
    }
  ]
  const commitment = TransactionHelper.getInputsCommitment([consumedOutput]);
  return createPayload(networkId, [prevAliasInput], [nextAlias], commitment, walletKeyPair)
}
