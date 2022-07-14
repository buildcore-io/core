import * as lib from "@iota/iota.js-next";
import { Converter } from "@iota/util.js-next";
import { cloneDeep } from "lodash";
import { fetchAndWaitForBasicOutput } from "../../../utils/basic-output.utils";
import { Bech32AddressHelper } from "../../../utils/bech32-address.helper";
import { MnemonicService } from "../mnemonic";
import { AddressDetails, Wallet } from "../wallet";
import { createPayload } from "./common.utils";

export const createAliasOutput = (amount: number, ownerAddressHex: string, metadata = 'no-metadata'): lib.IAliasOutput => {
  const address: lib.AddressTypes = { type: lib.ED25519_ADDRESS_TYPE, pubKeyHash: ownerAddressHex }
  return {
    type: lib.ALIAS_OUTPUT_TYPE,
    amount: amount.toString(),
    aliasId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    stateIndex: 0,
    foundryCounter: 0,
    immutableFeatures: [
      { type: lib.ISSUER_FEATURE_TYPE, address },
      { type: lib.METADATA_FEATURE_TYPE, data: Converter.utf8ToHex(metadata, true) }
    ],
    unlockConditions: [
      { type: lib.STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE, address },
      { type: lib.GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE, address }
    ]
  }
}

export const createAlias = async (client: lib.SingleNodeClient, networkId: string, address: AddressDetails): Promise<lib.ITransactionPayload> => {
  const consumedOutputId = await fetchAndWaitForBasicOutput(client, address.bech32);
  const consumedOutput = (await client.output(consumedOutputId)).output;

  const aliasOutput = createAliasOutput(Number(consumedOutput.amount), address.hex)
  const input = lib.TransactionHelper.inputFromOutputId(consumedOutputId)
  const inputsCommitment = lib.TransactionHelper.getInputsCommitment([consumedOutput])

  return createPayload(networkId, [input], [aliasOutput], inputsCommitment, address.keyPair)
}

export const transferAlias = (
  consumedOutput: lib.OutputTypes,
  consumedOutputId: string,
  walletKeyPair: lib.IKeyPair,
  targetAddress: lib.AddressTypes,
  networkId: string
): lib.ITransactionPayload => {
  const prevAliasInput = lib.TransactionHelper.inputFromOutputId(consumedOutputId);
  const nextAlias = cloneDeep(consumedOutput) as lib.IAliasOutput;
  nextAlias.unlockConditions = [
    { type: lib.STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress },
    { type: lib.GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }
  ]
  const commitment = lib.TransactionHelper.getInputsCommitment([consumedOutput]);
  return createPayload(networkId, [prevAliasInput], [nextAlias], commitment, walletKeyPair)
}

export const getAliasGovernorAddress = async (wallet: Wallet, alias: lib.IAliasOutput, info: lib.INodeInfo) => {
  const governorUnlockConditions = alias.unlockConditions.filter(u => u.type === lib.GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE)
  const governorBech32 = Bech32AddressHelper.addressFromAddressUnlockCondition(governorUnlockConditions, info.protocol.bech32HRP, lib.ALIAS_OUTPUT_TYPE)
  return await wallet.getIotaAddressDetails(await MnemonicService.get(governorBech32))
}
