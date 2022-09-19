import { Bech32Helper, GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE, IAliasOutput, IFoundryOutput, IndexerPluginClient, REFERENCE_UNLOCK_TYPE, STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE, TransactionHelper, UnlockTypes } from "@iota/iota.js-next";
import { cloneDeep, isEmpty } from "lodash";
import { Member, Token, Transaction } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import admin from "../../admin.config";
import { getAddress } from "../../utils/address.utils";
import { packBasicOutput } from "../../utils/basic-output.utils";
import { packEssence, packPayload, submitBlock } from "../../utils/block.utils";
import { createUnlock } from "../../utils/smr.utils";
import { createAliasOutput } from "../../utils/token-minting-utils/alias.utils";
import { createFoundryOutput, getVaultAndGuardianOutput, tokenToFoundryMetadata } from "../../utils/token-minting-utils/foundry.utils";
import { getTotalDistributedTokenCount } from "../../utils/token-minting-utils/member.utils";
import { MnemonicService } from "./mnemonic";
import { SmrParams, SmrWallet } from "./SmrWalletService";
import { setConsumedOutputIds } from "./wallet";

export class NativeTokenWallet {
  constructor(private readonly wallet: SmrWallet) { }

  public mintAlias = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress)
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32)
    const outputsMap = await this.wallet.getOutputs(sourceAddress.bech32, sourceMnemonic.consumedOutputIds)
    const totalAmount = Object.values(outputsMap).reduce((acc, act) => acc + Number(act.amount), 0)

    const aliasOutput = createAliasOutput(sourceAddress, this.wallet.info)
    const remainderAmount = totalAmount - Number(aliasOutput.amount)
    const remainder = packBasicOutput(sourceAddress.bech32, remainderAmount, [], this.wallet.info)

    const inputs = Object.keys(outputsMap).map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(outputsMap));

    const outputs = remainderAmount ? [aliasOutput, remainder] : [aliasOutput]
    const essence = packEssence(inputs, inputsCommitment, outputs, this.wallet, params)

    await setConsumedOutputIds(sourceAddress.bech32, Object.keys(outputsMap))
    return submitBlock(this.wallet, packPayload(essence, [createUnlock(essence, sourceAddress.keyPair)]))
  }

  public createFoundryOutput = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress)
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32)
    const outputsMap = await this.wallet.getOutputs(sourceAddress.bech32, sourceMnemonic.consumedOutputIds)
    const totalAmount = Object.values(outputsMap).reduce((acc, act) => acc + Number(act.amount), 0)

    const aliasOutputs = await this.getAliasOutputs(undefined, sourceAddress.bech32, sourceMnemonic.consumedAliasOutputIds)

    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0]
    const nextAliasOutput = cloneDeep(aliasOutput) as IAliasOutput;
    nextAliasOutput.aliasId = TransactionHelper.resolveIdFromOutputId(aliasOutputId);
    nextAliasOutput.stateIndex++;
    nextAliasOutput.foundryCounter++;

    const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).get()).data()
    const foundryOutput = createFoundryOutput(token.totalSupply, nextAliasOutput, tokenToFoundryMetadata(token), this.wallet.info)

    const totalDistributed = await getTotalDistributedTokenCount(token)
    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${transaction.member}`).get()).data()
    const vaultAndGuardianOutput = await getVaultAndGuardianOutput(
      nextAliasOutput,
      foundryOutput,
      totalDistributed,
      sourceAddress,
      getAddress(member, transaction.network!),
      token.totalSupply,
      this.wallet.info
    )
    const remainderAmount = [foundryOutput, ...vaultAndGuardianOutput].reduce((acc, act) => acc - Number(act.amount), totalAmount)
    const remainder = packBasicOutput(sourceAddress.bech32, remainderAmount, [], this.wallet.info)

    await saveAliasAndFoundryOutput(token.uid, nextAliasOutput, foundryOutput, totalDistributed)

    const inputs = [...Object.keys(outputsMap), aliasOutputId].map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment([...Object.values(outputsMap), aliasOutput]);

    const baseOutputs = [nextAliasOutput, foundryOutput, ...vaultAndGuardianOutput]
    const outputs = remainderAmount ? [...baseOutputs, remainder] : baseOutputs
    const essence = packEssence(inputs, inputsCommitment, outputs, this.wallet, params)
    const unlocks: UnlockTypes[] = [createUnlock(essence, sourceAddress.keyPair), { type: REFERENCE_UNLOCK_TYPE, reference: 0 }]

    await setConsumedOutputIds(sourceAddress.bech32, Object.keys(outputsMap), [], [aliasOutputId])
    return submitBlock(this.wallet, packPayload(essence, unlocks))
  }

  public changeAliasOwner = async (transaction: Transaction, params: SmrParams) => {
    const sourceMnemonic = await MnemonicService.getData(transaction.payload.sourceAddress)
    const aliasOutputs = await this.getAliasOutputs(transaction.payload.aliasId, undefined, sourceMnemonic.consumedAliasOutputIds)
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0]

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress)
    const targetAddress = Bech32Helper.addressFromBech32(transaction.payload.targetAddress, this.wallet.info.protocol.bech32Hrp)
    const nextAliasOutput = cloneDeep(aliasOutput);
    nextAliasOutput.unlockConditions = [
      { type: STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress },
      { type: GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }
    ]

    const inputs = [aliasOutputId].map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment([aliasOutput]);
    const essence = packEssence(inputs, inputsCommitment, [nextAliasOutput], this.wallet, params)

    await setConsumedOutputIds(sourceAddress.bech32, [], [], [aliasOutputId])
    return await submitBlock(this.wallet, packPayload(essence, [createUnlock(essence, sourceAddress.keyPair)]))
  }

  public getAliasOutputs = async (aliasId: string | undefined, sourceAddress: string | undefined, prevConsumedAliasOutputId: string[] = []) => {
    const outputIds = await this.getAliasOutputIds(aliasId, sourceAddress, prevConsumedAliasOutputId)
    const outputs: { [key: string]: IAliasOutput } = {}
    for (const id of outputIds) {
      const output = (await this.wallet.client.output(id)).output
      outputs[id] = output as IAliasOutput
    }
    return outputs
  }

  public getAliasOutputIds = async (aliasId: string | undefined, addressBech32: string | undefined, prevConsumedAliasOutputId: string[] = []) => {
    const indexer = new IndexerPluginClient(this.wallet.client)
    if (!isEmpty(prevConsumedAliasOutputId)) {
      return prevConsumedAliasOutputId
    }
    if (aliasId) {
      return (await indexer.alias(aliasId)).items
    }
    const items = (await indexer.aliases({ governorBech32: addressBech32 })).items
    return isEmpty(items) ? [] : [items[0]]
  }

}

const saveAliasAndFoundryOutput = (
  tokenId: string,
  aliasOutput: IAliasOutput,
  foundryOutput: IFoundryOutput,
  tokensInVault: number
) => {
  const foundryId = TransactionHelper.constructTokenId(aliasOutput.aliasId, foundryOutput.serialNumber, foundryOutput.tokenScheme.type);
  return admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).update({
    'mintingData.aliasId': aliasOutput.aliasId,
    'mintingData.tokenId': foundryId,
    'mintingData.tokensInVault': tokensInVault,
  })
}
