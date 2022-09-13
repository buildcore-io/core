import { Bech32Helper, TransactionHelper } from '@iota/iota.js-next';
import { Member, Token, TokenStatus, Transaction } from '../../../interfaces/models';
import { COL } from '../../../interfaces/models/base';
import admin from '../../admin.config';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from "../../services/wallet/wallet";
import { getAddress } from '../../utils/address.utils';
import { submitBlocks } from '../../utils/block.utils';
import { createAlias, transferAlias } from '../../utils/token-minting-utils/alias.utils';
import { createFoundryAndNextAlias } from '../../utils/token-minting-utils/foundry.utils';
import { getTotalDistributedTokenCount } from '../../utils/token-minting-utils/member.utils';
import { getTransactionPayloadHex } from '../../utils/smr.utils';

export const executeTokenMinting = async (transaction: Transaction) => {
  const wallet = await WalletService.newWallet(transaction.network)
  const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${transaction.member}`).get()).data()
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).get()).data()
  const source = await wallet.getAddressDetails(transaction.payload.sourceAddress)
  const target = getAddress(member, transaction.network!)

  const totalDistributed = await getTotalDistributedTokenCount(token)

  await mintToken(wallet as SmrWallet, source, target, token, totalDistributed)

  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({
    status: TokenStatus.MINTING,
    'mintingData.mintedBy': transaction.member,
    'mintingData.network': transaction.network,
    'mintingData.vaultAddress': source.bech32,
    'mintingData.tokensInVault': totalDistributed
  })
}

const mintToken = async (wallet: SmrWallet, source: AddressDetails, targetBech32: string, token: Token, totalDistributed: number) => {
  const info = await wallet.client.info()
  const networkId = TransactionHelper.networkIdFromNetworkName(info.protocol.networkName)

  const aliasOutput = await createAlias(wallet, networkId, source);

  const foundryAndNextAliasOutput = await createFoundryAndNextAlias(
    aliasOutput.essence.outputs[0],
    getTransactionPayloadHex(aliasOutput),
    source,
    targetBech32,
    info,
    token,
    totalDistributed
  );

  const targetAddress = Bech32Helper.addressFromBech32(targetBech32, info.protocol.bech32Hrp)
  const transferAliasOutput = transferAlias(
    foundryAndNextAliasOutput.essence.outputs[0],
    getTransactionPayloadHex(foundryAndNextAliasOutput),
    source,
    targetAddress,
    networkId
  );

  const payloads = [aliasOutput, foundryAndNextAliasOutput, transferAliasOutput]
  await submitBlocks(wallet.client, payloads)
}


