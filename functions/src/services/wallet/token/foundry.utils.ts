import { AddressTypes, ALIAS_ADDRESS_TYPE, FOUNDRY_OUTPUT_TYPE, IAliasOutput, IFoundryOutput, IKeyPair, IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE, IRent, ITransactionPayload, METADATA_FEATURE_TYPE, OutputTypes, SIMPLE_TOKEN_SCHEME_TYPE, TransactionHelper } from "@iota/iota.js-next";
import { Converter, HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import { cloneDeep } from "lodash";
import { COL, SUB_COL } from "../../../../interfaces/models/base";
import { Token, TokenDistribution } from "../../../../interfaces/models/token";
import admin from "../../../admin.config";
import { createBasicOutput, createPayload } from "./common.utils";

const createFoundryOutput = (maximumSupply: number, mintedTokens: number, aliasId: string, metadata: string): IFoundryOutput => ({
  type: FOUNDRY_OUTPUT_TYPE,
  amount: "0",
  serialNumber: 1,
  tokenScheme: {
    type: SIMPLE_TOKEN_SCHEME_TYPE,
    mintedTokens: HexHelper.fromBigInt256(bigInt(mintedTokens)),
    meltedTokens: HexHelper.fromBigInt256(bigInt(0)),
    maximumSupply: HexHelper.fromBigInt256(bigInt(maximumSupply)),
  },
  unlockConditions: [{ type: IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE, address: { type: ALIAS_ADDRESS_TYPE, aliasId } }],
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
): Promise<{ totalStorageDeposit: number; tokenId: string; payload: ITransactionPayload }> => {
  const maxSupply = token.totalSupply
  const minted = maxSupply - (await getTokensOwnedByMembers(token))
  const aliasInput = TransactionHelper.inputFromOutputId(consumedOutputId);
  const nextAliasOutput = cloneDeep(consumedOutput) as IAliasOutput;
  nextAliasOutput.aliasId = TransactionHelper.resolveIdFromOutputId(consumedOutputId);

  nextAliasOutput.stateIndex++;
  nextAliasOutput.foundryCounter++;

  const foundryOutput = createFoundryOutput(maxSupply, minted, nextAliasOutput.aliasId, token.symbol)

  const tokenId = TransactionHelper.constructTokenId(nextAliasOutput.aliasId, foundryOutput.serialNumber, foundryOutput.tokenScheme.type);

  const remainderOutput = createBasicOutput(minted, tokenId, targetAddress)

  const aliasStorageDeposit = TransactionHelper.getStorageDeposit(nextAliasOutput, rentStructure);
  const foundryStorageDeposit = TransactionHelper.getStorageDeposit(foundryOutput, rentStructure);
  const basicStorageDeposit = TransactionHelper.getStorageDeposit(remainderOutput, rentStructure);

  const totalStorageDeposit = aliasStorageDeposit + foundryStorageDeposit + basicStorageDeposit
  if (parseInt(consumedOutput.amount) < totalStorageDeposit!) {
    throw new Error("Initial funds not enough to cover for storage deposits");
  }

  nextAliasOutput.amount = aliasStorageDeposit.toString();
  foundryOutput.amount = foundryStorageDeposit.toString();
  remainderOutput.amount = (parseInt(consumedOutput.amount) - (aliasStorageDeposit + foundryStorageDeposit)).toString();

  const commitment = TransactionHelper.getInputsCommitment([consumedOutput]);
  const outputs = [nextAliasOutput, foundryOutput, remainderOutput]
  const payload = createPayload(networkId, [aliasInput], outputs, commitment, walletKeyPair)
  return { totalStorageDeposit, tokenId, payload }
}

const getTokensOwnedByMembers = async (token: Token) => {
  const snap = await admin.firestore().collection(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}`).get()
  return snap.docs.reduce((acc, doc) => {
    const dist = <TokenDistribution>doc.data()
    return acc + (dist.tokenOwned || 0)
  }, 0)
}
