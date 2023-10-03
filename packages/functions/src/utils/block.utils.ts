import { KEY_NAME_TANGLE } from '@build-5/interfaces';
import {
  DEFAULT_PROTOCOL_VERSION,
  IBlock,
  ITransactionEssence,
  ITransactionPayload,
  IUTXOInput,
  MAX_BLOCK_LENGTH,
  OutputTypes,
  TAGGED_DATA_PAYLOAD_TYPE,
  TRANSACTION_ESSENCE_TYPE,
  TRANSACTION_PAYLOAD_TYPE,
  TransactionHelper,
  UnlockTypes,
  serializeBlock,
} from '@iota/iota.js-next';
import { Converter, WriteStream } from '@iota/util.js-next';
import { Wallet, WalletParams } from '../services/wallet/wallet';

export const submitBlock = async (
  wallet: Wallet,
  payload: ITransactionPayload,
): Promise<string> => {
  const block: IBlock = {
    protocolVersion: DEFAULT_PROTOCOL_VERSION,
    parents: [],
    payload,
    nonce: '0',
  };
  return await wallet.client.blockSubmit(block);
};

export const packEssence = (
  inputs: IUTXOInput[],
  inputsCommitment: string,
  outputs: OutputTypes[],
  wallet: Wallet,
  params: WalletParams,
) =>
  <ITransactionEssence>{
    type: TRANSACTION_ESSENCE_TYPE,
    networkId: TransactionHelper.networkIdFromNetworkName(wallet.info.protocol.networkName),
    inputs,
    outputs,
    inputsCommitment,
    payload: {
      type: TAGGED_DATA_PAYLOAD_TYPE,
      tag: Converter.utf8ToHex(KEY_NAME_TANGLE, true),
      data: Converter.utf8ToHex(params.data || '', true),
    },
  };

export const packPayload = (essence: ITransactionEssence, unlocks: UnlockTypes[]) =>
  <ITransactionPayload>{ type: TRANSACTION_PAYLOAD_TYPE, essence, unlocks };

export const isValidBlockSize = (block: IBlock) => {
  const writeStream = new WriteStream();
  serializeBlock(writeStream, block);
  const blockBytes = writeStream.finalBytes();
  return blockBytes.length < MAX_BLOCK_LENGTH - 256;
};

export const indexToString = (index: number) => {
  const str = index.toString(16);
  return (str.length < 2 ? '0' : '') + str + '00';
};
