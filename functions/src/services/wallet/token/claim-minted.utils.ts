import * as lib from "@iota/iota.js-next";
import { INodeInfo, OutputTypes } from "@iota/iota.js-next";
import { HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import { cloneDeep } from "lodash";
import { WenError } from "../../../../interfaces/errors";
import { Member } from "../../../../interfaces/models";
import { COL, SUB_COL } from "../../../../interfaces/models/base";
import { Token, TokenDistribution } from "../../../../interfaces/models/token";
import admin from "../../../admin.config";
import { getAddress } from "../../../utils/address.utils";
import { Bech32AddressHelper } from "../../../utils/bech32-address.helper";
import { throwInvalidArgument } from "../../../utils/error.utils";
import { MnemonicService } from "../mnemonic";
import { AddressDetails, Wallet } from "../wallet";
import { createUnlock } from "./common.utils";

export const getClaimableTokenCount = async (transaction: admin.firestore.Transaction, member: string, token: Token) => {
  const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`);
  const distribution = <TokenDistribution | undefined>(await transaction.get(distributionDocRef)).data()
  const tokenOwned = distribution?.mintedClaimedOn ? 0 : (distribution?.tokenOwned || 0)
  const guardianOwned = await getUnallocatedTokenCountIfGuardian(member, token)
  const total = tokenOwned + guardianOwned
  if (!total) {
    throw throwInvalidArgument(WenError.no_tokens_to_claim)
  }
  return total
}

const getUnallocatedTokenCountIfGuardian = async (member: string, token: Token) => {
  const isGuardian = (await admin.firestore().doc(`${COL.SPACE}/${token.space}/${SUB_COL.GUARDIANS}/${member}`).get()).exists
  if (!isGuardian || token.mintingData?.claimedByGuardian) {
    return 0
  }
  const distributionSnap = await admin.firestore().collection(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}`).get()
  const totalOwnedByMembers = distributionSnap.docs.reduce((acc, act) => acc + ((<TokenDistribution>act.data()).tokenOwned || 0), 0)
  return token.totalSupply - totalOwnedByMembers
}

export const mintMoreTokens = async (
  info: INodeInfo,
  wallet: Wallet,
  consumedOutput: OutputTypes,
  consumedOutputId: string,
  controllingAliasOutput: lib.IAliasOutput,
  controllingAliasOutputId: string,
  foundryOutput: lib.IFoundryOutput,
  foundryOutputId: string,
  toBeMinted: number,
  address: AddressDetails,
  targetBech: string
): Promise<lib.ITransactionPayload> => {
  const input = lib.TransactionHelper.inputFromOutputId(consumedOutputId)
  const aliasInput = lib.TransactionHelper.inputFromOutputId(controllingAliasOutputId);
  const foundryInput = lib.TransactionHelper.inputFromOutputId(foundryOutputId);

  const nextAlias = cloneDeep(controllingAliasOutput);
  nextAlias.stateIndex++;

  const nextFoundry = cloneDeep(foundryOutput);
  const currentMinted = HexHelper.toBigInt256(foundryOutput.tokenScheme.mintedTokens)
  nextFoundry.tokenScheme.mintedTokens = HexHelper.fromBigInt256(currentMinted.add(bigInt(toBeMinted)))

  const tokenId = lib.TransactionHelper.constructTokenId(controllingAliasOutput.aliasId, foundryOutput.serialNumber, foundryOutput.tokenScheme.type);

  const targetAddress = lib.Bech32Helper.addressFromBech32(targetBech, info.protocol.bech32HRP)
  const remainderOutput: lib.IBasicOutput = {
    type: lib.BASIC_OUTPUT_TYPE,
    amount: consumedOutput.amount,
    nativeTokens: [{ id: tokenId, amount: HexHelper.fromBigInt256(bigInt(toBeMinted)) }],
    unlockConditions: [{ type: lib.ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }]
  }

  const inputsCommitment = lib.TransactionHelper.getInputsCommitment([controllingAliasOutput, foundryOutput, consumedOutput]);
  const essence: lib.ITransactionEssence = {
    type: lib.TRANSACTION_ESSENCE_TYPE,
    networkId: lib.TransactionHelper.networkIdFromNetworkName(info.protocol.networkName),
    inputs: [aliasInput, foundryInput, input],
    outputs: [nextAlias, nextFoundry, remainderOutput],
    inputsCommitment
  };

  const governorUnlockConditions = controllingAliasOutput.unlockConditions.filter(u => u.type === lib.GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE)
  const governorBech32 = Bech32AddressHelper.addressFromAddressUnlockCondition(governorUnlockConditions, info.protocol.bech32HRP, lib.ALIAS_OUTPUT_TYPE)
  const governorAddress = await wallet.getIotaAddressDetails(await MnemonicService.get(governorBech32))

  const unlocks: lib.UnlockTypes[] = [
    createUnlock(essence, governorAddress.keyPair),
    { type: lib.ALIAS_UNLOCK_TYPE, reference: 0 },
    createUnlock(essence, address.keyPair)
  ];
  return { type: lib.TRANSACTION_PAYLOAD_TYPE, essence: essence, unlocks };
}
export const getStorageDepositForClaimingToken = async (
  transaction: admin.firestore.Transaction,
  member: Member,
  token: Token,
  info: INodeInfo
) => {
  const claimableTokenCount = await getClaimableTokenCount(transaction, member.uid, token)
  const targetAddress = lib.Bech32Helper.addressFromBech32(getAddress(member.validatedAddress, token.mintingData?.network!), info.protocol.bech32HRP)
  const remainderOutput: lib.IBasicOutput = {
    type: lib.BASIC_OUTPUT_TYPE,
    amount: "0",
    nativeTokens: [{ id: token.mintingData?.tokenId!, amount: HexHelper.fromBigInt256(bigInt(claimableTokenCount)) }],
    unlockConditions: [{ type: lib.ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }]
  }
  return lib.TransactionHelper.getStorageDeposit(remainderOutput, info.protocol.rentStructure);
}
