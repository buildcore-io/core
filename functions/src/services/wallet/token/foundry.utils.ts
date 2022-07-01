import { AddressTypes, ADDRESS_UNLOCK_CONDITION_TYPE, ALIAS_ADDRESS_TYPE, BASIC_OUTPUT_TYPE, FOUNDRY_OUTPUT_TYPE, IAliasOutput, IBasicOutput, IFoundryOutput, IKeyPair, IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE, IRent, ITransactionPayload, METADATA_FEATURE_TYPE, OutputTypes, SIMPLE_TOKEN_SCHEME_TYPE, TransactionHelper } from "@iota/iota.js-next";
import { Converter, HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import { cloneDeep } from "lodash";
import { MIN_IOTA_AMOUNT } from "../../../../interfaces/config";
import { Token } from "../../../../interfaces/models/token";
import { createPayload } from "./common.utils";

const createFoundryOutput = (maximumSupply: number, alias: IAliasOutput, metadata: string): IFoundryOutput => ({
  type: FOUNDRY_OUTPUT_TYPE,
  amount: "0",
  serialNumber: alias.foundryCounter,
  tokenScheme: {
    type: SIMPLE_TOKEN_SCHEME_TYPE,
    mintedTokens: HexHelper.fromBigInt256(bigInt(0)),
    meltedTokens: HexHelper.fromBigInt256(bigInt(0)),
    maximumSupply: HexHelper.fromBigInt256(bigInt(maximumSupply)),
  },
  unlockConditions: [{ type: IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE, address: { type: ALIAS_ADDRESS_TYPE, aliasId: alias.aliasId } }],
  immutableFeatures: [{ type: METADATA_FEATURE_TYPE, data: Converter.utf8ToHex(metadata, true) }]
})

export const createFoundryMintToken = async (
  consumedOutput: OutputTypes,
  consumedOutputId: string,
  walletKeyPair: IKeyPair,
  targetAddress: AddressTypes,
  rentStructure: IRent,
  networkId: string,
  token: Token
): Promise<{ totalStorageDeposit: number; payload: ITransactionPayload }> => {
  const maxSupply = token.totalSupply
  const aliasInput = TransactionHelper.inputFromOutputId(consumedOutputId);
  const nextAliasOutput = cloneDeep(consumedOutput) as IAliasOutput;
  nextAliasOutput.aliasId = TransactionHelper.resolveIdFromOutputId(consumedOutputId);

  nextAliasOutput.stateIndex++;
  nextAliasOutput.foundryCounter++;

  const foundryOutput = createFoundryOutput(maxSupply, nextAliasOutput, JSON.stringify({ uid: token.uid, symbol: token.symbol }))

  const aliasStorageDeposit = TransactionHelper.getStorageDeposit(nextAliasOutput, rentStructure);
  const foundryStorageDeposit = TransactionHelper.getStorageDeposit(foundryOutput, rentStructure);

  if (parseInt(consumedOutput.amount) < aliasStorageDeposit + foundryStorageDeposit) {
    throw new Error("Initial funds not enough to cover for storage deposits");
  }

  nextAliasOutput.amount = aliasStorageDeposit.toString();
  foundryOutput.amount = foundryStorageDeposit.toString();

  const remainderOutput: IBasicOutput = {
    type: BASIC_OUTPUT_TYPE,
    amount: MIN_IOTA_AMOUNT.toString(),
    unlockConditions: [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }]
  }

  const commitment = TransactionHelper.getInputsCommitment([consumedOutput]);
  const outputs = [nextAliasOutput, foundryOutput, remainderOutput]
  const payload = createPayload(networkId, [aliasInput], outputs, commitment, walletKeyPair)
  return { totalStorageDeposit: MIN_IOTA_AMOUNT + aliasStorageDeposit + foundryStorageDeposit, payload }
}
