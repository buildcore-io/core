import { Bech32Helper, TransactionHelper } from '@iota/iota.js-next';
import { Member } from '../../../../interfaces/models';
import { COL } from '../../../../interfaces/models/base';
import { Token, TokenStatus } from '../../../../interfaces/models/token';
import { TransactionOrder } from '../../../../interfaces/models/transaction';
import admin from '../../../admin.config';
import { getAddress } from '../../../utils/address.utils';
import { submitBlocks } from '../../../utils/block.utils';
import { serverTime } from "../../../utils/dateTime.utils";
import { getTransactionPayloadHex } from '../../../utils/smr.utils';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../wallet/wallet';
import { TransactionMatch, TransactionService } from '../transaction-service';
import { createAlias, transferAlias } from './mint-utils/alias.utils';
import { createFoundryAndNextAlias } from './mint-utils/foundry.utils';
import { getTotalDistributedTokenCount } from './mint-utils/member.utils';

export class TokenMintService {

  constructor(readonly transactionService: TransactionService) { }

  public handleMintingRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`)
    const token = <Token>(await this.transactionService.transaction.get(tokenDocRef)).data()

    const payment = this.transactionService.createPayment(order, match);
    if (token.status !== TokenStatus.READY_TO_MINT) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId)

    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${order.member}`).get()).data()

    const wallet = await WalletService.newWallet(order.targetNetwork)
    const source = await wallet.getAddressDetails(order.payload.targetAddress)
    const target = getAddress(member, order.targetNetwork!)

    const totalDistributed = await getTotalDistributedTokenCount(token)
    await mintToken(wallet as SmrWallet, source, target, token, totalDistributed)

    const data = {
      status: TokenStatus.MINTING,
      mintingData: {
        mintedBy: order.member,
        mintedOn: serverTime(),
        network: order.targetNetwork,
        vaultAddress: order.payload.targetAddress,
        tokensInVault: totalDistributed
      }
    }
    this.transactionService.updates.push({ ref: tokenDocRef, data, action: 'set', merge: true });
  }
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
