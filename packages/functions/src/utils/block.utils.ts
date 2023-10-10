import { KEY_NAME_TANGLE } from '@build-5/interfaces';
import {
  CoinType,
  Output,
  RegularTransactionEssence,
  TaggedDataPayload,
  TransactionEssence,
  TransactionPayload,
  UTXOInput,
  Unlock,
  Utils,
  utf8ToHex,
} from '@iota/sdk';
import { Wallet, WalletParams } from '../services/wallet/wallet';
import { AddressDetails } from '../services/wallet/wallet.service';
import { getSecretManager } from './secret.manager.utils';

export const submitBlock = async (
  wallet: Wallet,
  essence: TransactionEssence,
  unlocks: Unlock[],
): Promise<string> =>
  (await wallet.client.postBlockPayload(new TransactionPayload(essence, unlocks)))[0];

export const packEssence = async (
  wallet: Wallet,
  inputs: UTXOInput[],
  inputsCommitment: string,
  outputs: Output[],
  params: WalletParams,
) =>
  new RegularTransactionEssence(
    await wallet.client.getNetworkId(),
    inputsCommitment,
    inputs,
    outputs,
    new TaggedDataPayload(utf8ToHex(KEY_NAME_TANGLE), utf8ToHex(params.data || '')),
  );

export const createUnlock = async (essence: TransactionEssence, address: AddressDetails) => {
  const essenceHash = Utils.hashTransactionEssence(essence);
  const secretManager = getSecretManager(address.mnemonic);
  return await secretManager.signatureUnlock(essenceHash, { coinType: CoinType.IOTA });
};

export const indexToString = (index: number) => {
  const str = index.toString(16);
  return (str.length < 2 ? '0' : '') + str + '00';
};
