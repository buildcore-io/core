import * as lib from "@iota/iota.js-next";
import { Converter, HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import { cloneDeep } from "lodash";
import { MIN_IOTA_AMOUNT } from "../../../../interfaces/config";
import { Token } from "../../../../interfaces/models/token";
import { createPayload } from "./common.utils";

export const createFoundryOutput = (maximumSupply: number, alias: lib.IAliasOutput, metadata: string): lib.IFoundryOutput => ({
  type: lib.FOUNDRY_OUTPUT_TYPE,
  amount: "0",
  serialNumber: alias.foundryCounter,
  tokenScheme: {
    type: lib.SIMPLE_TOKEN_SCHEME_TYPE,
    mintedTokens: HexHelper.fromBigInt256(bigInt(0)),
    meltedTokens: HexHelper.fromBigInt256(bigInt(0)),
    maximumSupply: HexHelper.fromBigInt256(bigInt(maximumSupply)),
  },
  unlockConditions: [{ type: lib.IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE, address: { type: lib.ALIAS_ADDRESS_TYPE, aliasId: alias.aliasId } }],
  immutableFeatures: [{ type: lib.METADATA_FEATURE_TYPE, data: Converter.utf8ToHex(metadata, true) }]
})

export const createFoundryMintToken = async (
  consumedOutput: lib.OutputTypes,
  consumedOutputId: string,
  walletKeyPair: lib.IKeyPair,
  targetAddress: lib.AddressTypes,
  rentStructure: lib.IRent,
  networkId: string,
  token: Token
): Promise<lib.ITransactionPayload> => {
  const maxSupply = token.totalSupply
  const aliasInput = lib.TransactionHelper.inputFromOutputId(consumedOutputId);
  const nextAliasOutput = cloneDeep(consumedOutput) as lib.IAliasOutput;
  nextAliasOutput.aliasId = lib.TransactionHelper.resolveIdFromOutputId(consumedOutputId);

  nextAliasOutput.stateIndex++;
  nextAliasOutput.foundryCounter++;

  const foundryOutput = createFoundryOutput(maxSupply, nextAliasOutput, JSON.stringify({ uid: token.uid, symbol: token.symbol }))

  const aliasStorageDeposit = lib.TransactionHelper.getStorageDeposit(nextAliasOutput, rentStructure);
  const foundryStorageDeposit = lib.TransactionHelper.getStorageDeposit(foundryOutput, rentStructure);

  nextAliasOutput.amount = aliasStorageDeposit.toString();
  foundryOutput.amount = foundryStorageDeposit.toString();

  const remainderOutput: lib.IBasicOutput = {
    type: lib.BASIC_OUTPUT_TYPE,
    amount: MIN_IOTA_AMOUNT.toString(),
    unlockConditions: [{ type: lib.ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }]
  }

  const commitment = lib.TransactionHelper.getInputsCommitment([consumedOutput]);
  const outputs = [nextAliasOutput, foundryOutput, remainderOutput]
  return createPayload(networkId, [aliasInput], outputs, commitment, walletKeyPair)
}
