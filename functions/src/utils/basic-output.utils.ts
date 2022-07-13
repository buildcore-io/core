import { ADDRESS_UNLOCK_CONDITION_TYPE, BASIC_OUTPUT_TYPE, Bech32Helper, DEFAULT_PROTOCOL_VERSION, IBasicOutput, IBlock, INativeToken, IndexerPluginClient, INodeInfo, ITimelockUnlockCondition, ITransactionPayload, MAX_BLOCK_LENGTH, serializeBlock, SingleNodeClient, STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE, TIMELOCK_UNLOCK_CONDITION_TYPE, TransactionHelper, UnlockConditionTypes } from "@iota/iota.js-next";
import { NeonPowProvider } from "@iota/pow-neon.js";
import { HexHelper, WriteStream } from "@iota/util.js-next";
import bigInt from "big-integer";
import dayjs from "dayjs";
import { cloneDeep, isEmpty } from "lodash";

export const hasNoTimeLock = (output: IBasicOutput) => {
  const locks = output.unlockConditions.filter(u => u.type === TIMELOCK_UNLOCK_CONDITION_TYPE) as ITimelockUnlockCondition[]
  return locks.reduce((acc, act) => acc && dayjs().isAfter(dayjs.unix(act.unixTime)), true)
}

export const hasNativeToken = (output: IBasicOutput, token: string) => !isEmpty(output.nativeTokens?.filter(n => n.id === token))

export const hasNoReturnCondition = (output: IBasicOutput) => output.unlockConditions.find(u => u.type === STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE) === undefined

export const nativeTokenCount = (output: IBasicOutput, token: string) =>
  output.nativeTokens?.reduce((acc, act) => act.id === token ? acc + Number(HexHelper.toBigInt256(act.amount)) : acc, 0) || 0

export const nativeTokenCountTotal = (outputs: IBasicOutput[], token: string) => outputs.reduce((acc, act) => acc + nativeTokenCount(act, token), 0) || 0

const addHex = (a: string, b: string) => HexHelper.fromBigInt256(HexHelper.toBigInt256(a).add(HexHelper.toBigInt256(b)))
export const subtractHex = (a: string, b: string) => HexHelper.fromBigInt256(HexHelper.toBigInt256(a).subtract(HexHelper.toBigInt256(b)))

export const mergeOutputs = (outputs: IBasicOutput[]) => {
  const addressUnlock = outputs[0].unlockConditions.find(u => u.type === ADDRESS_UNLOCK_CONDITION_TYPE)!
  const merged: IBasicOutput = { type: BASIC_OUTPUT_TYPE, amount: '0', unlockConditions: [addressUnlock] }
  for (const output of outputs) {
    const nativeTokens = merged.nativeTokens || []
    for (const nativeToken of (output.nativeTokens || [])) {
      const index = nativeTokens.findIndex(n => n.id === nativeToken.id)
      if (index === -1) {
        nativeTokens.push(nativeToken)
      } else {
        nativeTokens[index].amount = addHex(nativeTokens[index].amount, nativeToken.amount)
      }
    }
    merged.amount = (Number(output.amount) + Number(merged.amount)).toString()
    merged.nativeTokens = nativeTokens
  }
  return merged
}

export const packBasicOutput = (toBech32: string, amount: number, nativeToken: INativeToken | undefined, info: INodeInfo, retrunAddressBech32?: string) => {
  const targetAddress = Bech32Helper.addressFromBech32(toBech32, info.protocol.bech32HRP)
  const unlockConditions: UnlockConditionTypes[] = [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }]
  if (retrunAddressBech32) {
    const returnAddress = Bech32Helper.addressFromBech32(retrunAddressBech32, info.protocol.bech32HRP)
    unlockConditions.push({ type: STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE, amount: "0", returnAddress })
  }
  const output: IBasicOutput = {
    type: BASIC_OUTPUT_TYPE,
    amount: "0",
    nativeTokens: nativeToken ? [nativeToken] : undefined,
    unlockConditions
  }
  const storageDeposit = TransactionHelper.getStorageDeposit(output, info.protocol.rentStructure!)
  output.amount = bigInt.max(bigInt(amount), storageDeposit).toString()

  if (retrunAddressBech32) {
    output.unlockConditions = output.unlockConditions.map(u => u.type === STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE ? { ...u, amount: storageDeposit.toString() } : u)
  }
  return output
}

export const subtractNativeTokens = (output: IBasicOutput, amount: number, token: string, info: INodeInfo) => {
  const result = cloneDeep(output)
  result.amount = "0"
  const total = nativeTokenCount(output, token)
  if (total < amount) {
    throw new Error(`Not enough native tokens, ${token}, ${total}`)
  }
  result.nativeTokens = (result.nativeTokens || [])
    .map(n => n.id === token ? { ...n, amount: subtractHex(n.amount, HexHelper.fromBigInt256(bigInt(amount))) } : n)
    .filter(n => Number(n.amount) > 0)
  result.amount = TransactionHelper.getStorageDeposit(output, info.protocol.rentStructure).toString()
  return result
}

export const fetchAndWaitForBasicOutput = async (client: SingleNodeClient, addressBech32: string, hasNativeTokens = false): Promise<string> => {
  const indexerPluginClient = new IndexerPluginClient(client!);
  for (let i = 0; i < 10; ++i) {
    const outputsResponse = await indexerPluginClient.outputs({
      addressBech32,
      hasStorageReturnCondition: false,
      hasExpirationCondition: false,
      hasTimelockCondition: false,
      hasNativeTokens
    });
    if (outputsResponse.items.length) {
      return outputsResponse.items[0]
    }
    await new Promise(f => setTimeout(f, 5000));
  }
  throw new Error("Didn't find any outputs for address: " + addressBech32);
};


export const chainTransactionsViaBlocks = async (client: SingleNodeClient, txs: Array<ITransactionPayload>, minPoWScore: number): Promise<Array<IBlock>> => {
  const blockIds: Array<string> = [];
  const blocks: Array<IBlock> = [];

  const parents = (await client.tips()).tips;

  for (let i = 0; i < txs.length; i++) {
    const block: IBlock = {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      parents: [],
      payload: txs[i],
      nonce: "0"
    };

    if (i === 0) {
      block.parents = parents;
    } else {
      block.parents = [blockIds[i - 1]];
    }

    const blockNonce = await calculateNonce(block, minPoWScore);
    block.nonce = blockNonce;
    const blockId = TransactionHelper.calculateBlockId(block);
    blockIds.push(blockId);
    blocks.push(block);
  }

  return blocks;
}


const calculateNonce = async (block: IBlock, minPoWScore: number): Promise<string> => {
  const writeStream = new WriteStream();
  serializeBlock(writeStream, block);
  const blockBytes = writeStream.finalBytes();

  if (blockBytes.length > MAX_BLOCK_LENGTH) {
    throw new Error(
      `The block length is ${blockBytes.length}, which exceeds the maximum size of ${MAX_BLOCK_LENGTH}`
    );
  }

  const powProvider = new NeonPowProvider();
  const nonce = await powProvider.pow(blockBytes, minPoWScore);
  return nonce.toString();
}
