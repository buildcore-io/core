import * as lib from "@iota/iota.js-next";
import { INodeInfo, OutputTypes, UnlockConditionTypes } from "@iota/iota.js-next";
import { HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import dayjs from "dayjs";
import { cloneDeep, isEmpty } from "lodash";
import { WenError } from "../../../../interfaces/errors";
import { COL, SUB_COL } from "../../../../interfaces/models/base";
import { Token, TokenDistribution, TokenDrop } from "../../../../interfaces/models/token";
import admin from "../../../admin.config";
import { dateToTimestamp } from "../../../utils/dateTime.utils";
import { throwInvalidArgument } from "../../../utils/error.utils";
import { getRandomEthAddress } from "../../../utils/wallet.utils";
import { AddressDetails, Wallet } from "../wallet";
import { getAliasGovernorAddress } from "./alias.utils";
import { createUnlock } from "./common.utils";

export const getClaimableTokens = async (transaction: admin.firestore.Transaction, member: string, token: Token) => {
  const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`);
  const distribution = <TokenDistribution | undefined>(await transaction.get(distributionDocRef)).data()
  const tokenOwned = distribution?.mintedClaimedOn ? 0 : (distribution?.tokenOwned || 0)
  const guardianOwned = await getUnallocatedTokenCountIfGuardian(member, token)
  const drops = distribution?.tokenDrops || []
  if (tokenOwned) {
    drops.push({ uid: getRandomEthAddress(), count: tokenOwned, vestingAt: dateToTimestamp(dayjs()) })
  }
  if (guardianOwned) {
    drops.push({ uid: getRandomEthAddress(), count: guardianOwned, vestingAt: dateToTimestamp(dayjs()) })
  }
  if (isEmpty(drops)) {
    throw throwInvalidArgument(WenError.no_tokens_to_claim)
  }
  return drops
}

const getUnallocatedTokenCountIfGuardian = async (member: string, token: Token) => {
  const isGuardian = (await admin.firestore().doc(`${COL.SPACE}/${token.space}/${SUB_COL.GUARDIANS}/${member}`).get()).exists
  if (!isGuardian || token.mintingData?.claimedByGuardian) {
    return 0
  }
  const distributionSnap = await admin.firestore().collection(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}`).get()
  const totalOwnedByMembers = distributionSnap.docs.reduce((acc, act) => {
    const distribution = <TokenDistribution>act.data()
    const owned = distribution.tokenOwned || 0
    const vesting = distribution.tokenDrops?.reduce((acc, act) => acc + act.count, 0) || 0
    return acc + owned + vesting
  }, 0)
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
  drops: TokenDrop[],
  address: AddressDetails,
  targetBech: string
): Promise<lib.ITransactionPayload> => {
  const toBeMinted = getDropsTotal(drops)
  const input = lib.TransactionHelper.inputFromOutputId(consumedOutputId)
  const aliasInput = lib.TransactionHelper.inputFromOutputId(controllingAliasOutputId);
  const foundryInput = lib.TransactionHelper.inputFromOutputId(foundryOutputId);

  const nextAlias = cloneDeep(controllingAliasOutput);
  nextAlias.stateIndex++;

  const nextFoundry = cloneDeep(foundryOutput);
  const currentMinted = HexHelper.toBigInt256(foundryOutput.tokenScheme.mintedTokens)
  nextFoundry.tokenScheme.mintedTokens = HexHelper.fromBigInt256(currentMinted.add(bigInt(toBeMinted)))

  const governorAddress = await getAliasGovernorAddress(wallet, controllingAliasOutput, info)

  const tokenId = lib.TransactionHelper.constructTokenId(controllingAliasOutput.aliasId, foundryOutput.serialNumber, foundryOutput.tokenScheme.type);
  const outputs = await createBasicOutputsWithNativeTokens(targetBech, tokenId, info, drops)

  const inputsCommitment = lib.TransactionHelper.getInputsCommitment([controllingAliasOutput, foundryOutput, consumedOutput]);
  const essence: lib.ITransactionEssence = {
    type: lib.TRANSACTION_ESSENCE_TYPE,
    networkId: lib.TransactionHelper.networkIdFromNetworkName(info.protocol.networkName),
    inputs: [aliasInput, foundryInput, input],
    outputs: [nextAlias, nextFoundry, ...outputs],
    inputsCommitment
  };

  const unlocks: lib.UnlockTypes[] = [
    createUnlock(essence, governorAddress.keyPair),
    { type: lib.ALIAS_UNLOCK_TYPE, reference: 0 },
    createUnlock(essence, address.keyPair)
  ];
  return { type: lib.TRANSACTION_PAYLOAD_TYPE, essence: essence, unlocks };
}

export const createBasicOutputsWithNativeTokens = async (targetBech32: string, tokenId: string, info: INodeInfo, drops: TokenDrop[]) => {
  const targetAddress = lib.Bech32Helper.addressFromBech32(targetBech32, info.protocol.bech32HRP)
  return drops.map(drop => {
    const unlockConditions: UnlockConditionTypes[] = [{ type: lib.ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }]
    if (dayjs(drop.vestingAt.toDate()).isAfter(dayjs())) {
      unlockConditions.push({ type: lib.TIMELOCK_UNLOCK_CONDITION_TYPE, unixTime: drop.vestingAt.seconds })
    }
    const output: lib.IBasicOutput = {
      type: lib.BASIC_OUTPUT_TYPE,
      amount: "0",
      nativeTokens: [{ id: tokenId, amount: HexHelper.fromBigInt256(bigInt(drop.count)) }],
      unlockConditions
    }
    output.amount = lib.TransactionHelper.getStorageDeposit(output, info.protocol.rentStructure).toString();
    return output
  })
}

export const getDropsTotal = (drops: TokenDrop[]) => drops.reduce((acc, act) => acc + act.count, 0)
