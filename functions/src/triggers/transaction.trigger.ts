import { Bech32Helper, TransactionHelper } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import * as functions from 'firebase-functions';
import { DEFAULT_NETWORK, DEF_WALLET_PAY_IN_PROGRESS, MAX_WALLET_RETRY } from '../../interfaces/config';
import { WEN_FUNC } from '../../interfaces/functions';
import { BillPaymentTransaction, CreditPaymentTransaction, Entity, IOTATangleTransaction, Member, Network, Token, TokenStatus, Transaction, TransactionType, WalletResult } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { NativeToken } from '../../interfaces/models/milestone';
import { Nft } from '../../interfaces/models/nft';
import admin from '../admin.config';
import { getMessageIdFieldNameByNetwork } from '../cron/wallet.cron';
import { scale } from '../scale.settings';
import { IotaWallet } from '../services/wallet/IotaWalletService';
import { SmrWallet } from '../services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from "../services/wallet/wallet";
import { getAddress } from '../utils/address.utils';
import { submitBlocks } from '../utils/block.utils';
import { isEmulatorEnv, isProdEnv } from '../utils/config.utils';
import { serverTime } from "../utils/dateTime.utils";
import { createAlias, transferAlias } from '../utils/minting-utils/alias.utils';
import { createFoundryAndNextAlias } from '../utils/minting-utils/foundry.utils';
import { getTotalDistributedTokenCount } from '../utils/minting-utils/member.utils';
import { getTransactionPayloadHex } from '../utils/smr.utils';

export const transactionWrite = functions.runWith({
  timeoutSeconds: 540,
  minInstances: scale(WEN_FUNC.transactionWrite),
  memory: "512MB",
}).firestore.document(COL.TRANSACTION + '/{tranId}').onWrite(async (change) => {
  const prev = <Transaction | undefined>change.before.data();
  const curr = <Transaction | undefined>change.after.data();

  const isCreditOrBillPayment = (curr?.type === TransactionType.CREDIT || curr?.type === TransactionType.BILL_PAYMENT);
  const isCreate = (prev === undefined);
  const shouldRetry = (!prev?.shouldRetry && curr?.shouldRetry);

  if (curr && isCreditOrBillPayment && !curr?.ignoreWallet && (isCreate || shouldRetry)) {
    const WALLET_PAY_IN_PROGRESS = DEF_WALLET_PAY_IN_PROGRESS + Date.now();
    await execute(curr, WALLET_PAY_IN_PROGRESS)
    return;
  }

  if (curr && curr.type === TransactionType.MINT_TOKEN && (isCreate || shouldRetry)) {
    await executeTokenMinting(curr)
  }

  if (prev?.payload?.walletReference?.chainReference !== curr?.payload?.walletReference?.chainReference && curr?.payload?.walletReference?.chainReference) {
    const field = getMessageIdFieldNameByNetwork(curr?.network || DEFAULT_NETWORK)
    const subColSnap = await admin.firestore().collectionGroup(SUB_COL.TRANSACTIONS)
      .where(field, '==', curr?.payload?.walletReference?.chainReference)
      .get();
    if (subColSnap.size > 0) {
      await change.after.ref.update({ 'payload.walletReference.confirmed': true })
    }
  }
})

const execute = async (newValue: Transaction, WALLET_PAY_IN_PROGRESS: string) => {
  const shouldProcess = await admin.firestore().runTransaction(async (transaction) => {
    const refSource = admin.firestore().collection(COL.TRANSACTION).doc(newValue.uid);
    const sfDoc = await transaction.get(refSource);
    if (!sfDoc.data()) {
      return;
    }

    const tranData = <Transaction>sfDoc.data();
    const payload = <BillPaymentTransaction | CreditPaymentTransaction>tranData.payload
    if (
      !(payload.walletReference?.chainReference && payload.walletReference?.chainReference.startsWith(DEF_WALLET_PAY_IN_PROGRESS)) &&
      // Either not on chain yet or there was an error.
      (!payload.walletReference?.chainReference || payload.walletReference.error) &&
      // Not payment yet or at least one count happen to avoid loop
      (!payload.walletReference || (payload.walletReference.count > 0 && payload.walletReference.count <= MAX_WALLET_RETRY))
    ) {
      const walletResponse: WalletResult = payload.walletReference || {
        createdOn: serverTime(),
        processedOn: serverTime(),
        confirmed: false,
        chainReferences: [],
        count: 0
      };

      if (payload.walletReference?.chainReference) {
        walletReference.chainReferences?.push(payload.walletReference.chainReference);
      }

      // Reset defaults.
      walletResponse.error = null;
      walletResponse.chainReference = WALLET_PAY_IN_PROGRESS;

      // Set wallet reference.
      walletResponse.count = walletResponse.count + 1;
      walletResponse.processedOn = serverTime();
      payload.walletReference = walletResponse;
      tranData.shouldRetry = false;
      transaction.update(refSource, tranData);
      return true
    } else {
      console.log('Nothing to process.');
      return false
    }
  });

  if (!shouldProcess) {
    return;
  }

  // Trigger wallet
  const refSource = admin.firestore().collection(COL.TRANSACTION).doc(newValue.uid);
  const sfDoc = await refSource.get();
  const tranData = <Transaction>sfDoc.data();

  const payload = tranData.payload

  // If process is required.
  if (payload.walletReference?.chainReference !== WALLET_PAY_IN_PROGRESS) {
    return;
  }

  if (!isEmulatorEnv && payload.delay > 0) { // Standard Delay required.
    await new Promise(resolve => setTimeout(resolve, payload.delay));
  }

  // Prepare NFT details.
  const details = <IOTATangleTransaction>{};
  details.tranId = tranData.uid;
  details.network = isProdEnv() ? 'soon' : 'wen';
  if (tranData.type === TransactionType.BILL_PAYMENT) {
    details.payment = true;

    // Once space can own NFT this will be expanded.
    if (tranData.member) {
      details.previousOwner = payload.previousOwner;
      details.previousOwnerEntity = payload.previousOwnerEntity;
      details.owner = tranData.member;
      details.ownerEntity = Entity.MEMBER;
    }
    if (payload.royalty) {
      details.royalty = payload.royalty;
    }
    if (payload.collection) {
      details.collection = payload.collection;
    }
    if (payload.nft) {
      details.nft = payload.nft;

      // Get NFT details.
      const refNft: admin.firestore.DocumentReference = admin.firestore().collection(COL.NFT).doc(payload.nft);
      const docNftData = <Nft>(await refNft.get()).data();
      if (docNftData && docNftData.ipfsMedia) {
        details.ipfsMedia = docNftData.ipfsMedia;
      }
      if (docNftData && docNftData.ipfsMetadata) {
        details.ipfsMetadata = docNftData.ipfsMetadata;
      }
    }
    if (payload.token) {
      details.token = payload.token;
      details.quantity = payload.quantity || 0
    }
  }

  if (tranData.type === TransactionType.CREDIT) {
    details.refund = true;
    if (tranData.member) {
      details.member = tranData.member;
    } else if (tranData.space) {
      details.space = tranData.space;
    }
  }

  // Submit payment.
  const walletReference: WalletResult = <WalletResult>{};
  try {
    const walletService = await WalletService.newWallet(newValue.network);
    if ([Network.SMR, Network.RMS].includes(newValue.network!)) {
      walletReference.chainReference = await (walletService as SmrWallet).send(
        await walletService.getAddressDetails(payload.sourceAddress),
        payload.targetAddress,
        payload.amount,
        {
          nativeTokens: payload.nativeTokens?.map((nt: NativeToken) => ({ id: nt.id, amount: HexHelper.fromBigInt256(bigInt(nt.amount)) })),
          storageDepositSourceAddress: payload.storageDepositSourceAddress,
          vestingAt: payload.vestingAt,
          storageDepositReturnAddress: payload.storageReturn?.address
        }
      );
    } else {
      walletReference.chainReference = await (walletService as IotaWallet).send(
        await walletService.getAddressDetails(payload.sourceAddress),
        payload.targetAddress,
        payload.amount,
        { data: JSON.stringify(details) }
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletReference.chainReferences = admin.firestore.FieldValue.arrayUnion(walletReference.chainReference) as any;
  } catch (e) {
    functions.logger.error(newValue.uid, JSON.stringify(e))
    walletReference.error = JSON.stringify(e);
    walletReference.chainReference = null;
  }

  walletReference.processedOn = serverTime()
  await refSource.set({ payload: { walletReference } }, { merge: true })
}

const executeTokenMinting = async (transaction: Transaction) => {
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


