import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import {
  DEFAULT_NETWORK,
  DEF_WALLET_PAY_IN_PROGRESS,
  MAX_WALLET_RETRY,
} from '../../../interfaces/config';
import { WEN_FUNC } from '../../../interfaces/functions';
import {
  Member,
  Network,
  Stake,
  Transaction,
  TransactionMintCollectionType,
  TransactionMintTokenType,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
  WalletResult,
} from '../../../interfaces/models';
import { COL, SUB_COL } from '../../../interfaces/models/base';
import { Mnemonic } from '../../../interfaces/models/mnemonic';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { NativeTokenWallet } from '../../services/wallet/NativeTokenWallet';
import { NftWallet } from '../../services/wallet/NftWallet';
import { AliasWallet } from '../../services/wallet/smr-wallets/AliasWallet';
import { SmrParams, SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { getAddress } from '../../utils/address.utils';
import { isEmulatorEnv } from '../../utils/config.utils';
import { serverTime } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { unclockMnemonic } from '../milestone-transactions-triggers/common';
import { onCollectionMintingUpdate } from './collection-minting';
import { onTokenMintingUpdate } from './token-minting';
import { getWalletParams } from './wallet-params';

export const EXECUTABLE_TRANSACTIONS = [
  TransactionType.CREDIT,
  TransactionType.BILL_PAYMENT,
  TransactionType.MINT_COLLECTION,
  TransactionType.MINT_TOKEN,
  TransactionType.CREDIT_NFT,
  TransactionType.WITHDRAW_NFT,
  TransactionType.UNLOCK,
  TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED,
];

export const transactionWrite = functions
  .runWith({
    timeoutSeconds: 540,
    minInstances: scale(WEN_FUNC.transactionWrite),
    memory: '4GB',
  })
  .firestore.document(COL.TRANSACTION + '/{tranId}')
  .onWrite(async (change) => {
    const prev = <Transaction | undefined>change.before.data();
    const curr = <Transaction | undefined>change.after.data();

    if (!curr) {
      return;
    }

    const isExecutableType = EXECUTABLE_TRANSACTIONS.includes(curr.type);
    const isCreate = prev === undefined;
    const shouldRetry = !prev?.shouldRetry && curr?.shouldRetry;

    if (isExecutableType && !curr?.ignoreWallet && (isCreate || shouldRetry)) {
      return await executeTransaction(curr.uid);
    }

    if (
      curr.payload.type === TransactionOrderType.AIRDROP_MINTED_TOKEN &&
      !isEmpty(prev?.payload?.drops) &&
      isEmpty(curr.payload.drops)
    ) {
      await onMintedAirdropCleared(curr);
      return;
    }

    if (curr.type === TransactionType.MINT_COLLECTION && isConfirmed(prev, curr)) {
      await onCollectionMintingUpdate(curr);
      return;
    }

    if (curr.type === TransactionType.MINT_TOKEN && isConfirmed(prev, curr)) {
      await onTokenMintingUpdate(curr);
      return;
    }

    if (curr.type === TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED && isConfirmed(prev, curr)) {
      await admin
        .firestore()
        .doc(`${COL.TRANSACTION}/${curr.payload.transaction}`)
        .update({ 'payload.walletReference.confirmed': true });
      return;
    }

    if (
      curr.type === TransactionType.BILL_PAYMENT &&
      isConfirmed(prev, curr) &&
      !isEmpty(curr.payload.stake)
    ) {
      await confirmStaking(curr);
      return;
    }
  });

const executeTransaction = async (transactionId: string) => {
  const shouldProcess = await prepareTransaction(transactionId);
  if (!shouldProcess) {
    return;
  }

  const docRef = admin.firestore().collection(COL.TRANSACTION).doc(transactionId);
  const transaction = <Transaction>(await docRef.get()).data();
  const payload = transaction.payload;

  const params = await getWalletParams(transaction, transaction.network || DEFAULT_NETWORK);
  try {
    const walletService = await WalletService.newWallet(transaction.network || DEFAULT_NETWORK);
    const sourceAddress = await walletService.getAddressDetails(payload.sourceAddress);

    const submit = () => {
      switch (transaction.type) {
        case TransactionType.BILL_PAYMENT:
        case TransactionType.CREDIT:
          return walletService.send(sourceAddress, payload.targetAddress, payload.amount, params);
        case TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED:
          return (walletService as SmrWallet).creditLocked(transaction, params);

        case TransactionType.MINT_COLLECTION:
          return submitCollectionMintTransactions(transaction, walletService as SmrWallet, params);

        case TransactionType.MINT_TOKEN:
          return submitTokenMintTransactions(transaction, walletService as SmrWallet, params);

        case TransactionType.CREDIT_NFT:
        case TransactionType.WITHDRAW_NFT: {
          const nftWallet = new NftWallet(walletService as SmrWallet);
          return nftWallet.changeNftOwner(transaction, params);
        }

        case TransactionType.UNLOCK: {
          return submitUnlockTransaction(transaction, walletService as SmrWallet, params);
        }

        default: {
          functions.logger.error('Unsupported executable transaction type', transaction);
          throw Error('Unsupported executable transaction type ' + transaction.type);
        }
      }
    };

    const chainReference = await submit();
    await docRef.update({
      'payload.walletReference.processedOn': serverTime(),
      'payload.walletReference.chainReference': chainReference,
      'payload.walletReference.chainReferences':
        admin.firestore.FieldValue.arrayUnion(chainReference),
    });
  } catch (error) {
    functions.logger.error(transaction.uid, error);
    await docRef.update({
      'payload.walletReference.chainReference': null,
      'payload.walletReference.processedOn': serverTime(),
      'payload.walletReference.error': JSON.stringify(error),
    });
    await unclockMnemonic(payload.sourceAddress);
  }
};

const submitCollectionMintTransactions = (
  transaction: Transaction,
  wallet: SmrWallet,
  params: SmrParams,
) => {
  switch (transaction.payload.type) {
    case TransactionMintCollectionType.MINT_ALIAS: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.mintAlias(transaction, params);
    }
    case TransactionMintCollectionType.MINT_COLLECTION: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintCollection(transaction, params);
    }
    case TransactionMintCollectionType.MINT_NFTS: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintNfts(transaction, params);
    }
    case TransactionMintCollectionType.LOCK_COLLECTION: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.lockCollection(transaction, params);
    }
    case TransactionMintCollectionType.SENT_ALIAS_TO_GUARDIAN: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.changeAliasOwner(transaction, params);
    }
    default: {
      functions.logger.error('Unsupported executable transaction type', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const submitTokenMintTransactions = (
  transaction: Transaction,
  wallet: SmrWallet,
  params: SmrParams,
) => {
  switch (transaction.payload.type) {
    case TransactionMintTokenType.MINT_ALIAS: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.mintAlias(transaction, params);
    }
    case TransactionMintTokenType.MINT_FOUNDRY: {
      const nativeTokenWallet = new NativeTokenWallet(wallet);
      return nativeTokenWallet.mintFoundry(transaction, params);
    }
    case TransactionMintTokenType.SENT_ALIAS_TO_GUARDIAN: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.changeAliasOwner(transaction, params);
    }
    default: {
      functions.logger.error('Unsupported executable transaction type', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const submitUnlockTransaction = async (
  transaction: Transaction,
  wallet: SmrWallet,
  params: SmrParams,
) => {
  switch (transaction.payload.type) {
    case TransactionUnlockType.UNLOCK_FUNDS: {
      const sourceAddress = await wallet.getAddressDetails(transaction.payload.sourceAddress);
      return wallet.send(
        sourceAddress,
        transaction.payload.targetAddress,
        transaction.payload.amount,
        params,
      );
    }
    case TransactionUnlockType.UNLOCK_NFT: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.changeNftOwner(transaction, params);
    }
    default: {
      functions.logger.error('Unsupported executable transaction type', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const prepareTransaction = (transactionId: string) =>
  admin.firestore().runTransaction(async (transaction) => {
    const docRef = admin.firestore().collection(COL.TRANSACTION).doc(transactionId);
    const tranData = <Transaction | undefined>(await transaction.get(docRef)).data();
    if (
      isEmulatorEnv &&
      [Network.SMR, Network.IOTA].includes(tranData?.network || DEFAULT_NETWORK)
    ) {
      return false;
    }
    const walletResponse: WalletResult = tranData?.payload?.walletReference || emptyWalletResult();
    if (
      !tranData ||
      !isEmpty(walletResponse.chainReference) ||
      walletResponse.count > MAX_WALLET_RETRY
    ) {
      transaction.update(docRef, { shouldRetry: false });
      return false;
    }

    if (
      (await mnemonicsAreLocked(transaction, tranData)) ||
      tranData.payload.dependsOnBillPayment
    ) {
      walletResponse.chainReference = null;
      transaction.update(docRef, {
        shouldRetry: false,
        'payload.walletReference': walletResponse,
        'payload.dependsOnBillPayment': false,
      });
      return false;
    }

    walletResponse.error = null;
    walletResponse.chainReference = DEF_WALLET_PAY_IN_PROGRESS + Date.now();
    walletResponse.count = walletResponse.count + 1;
    walletResponse.processedOn = serverTime();
    walletResponse.inProgress = true;

    transaction.update(docRef, { shouldRetry: false, 'payload.walletReference': walletResponse });
    lockMnemonic(transaction, transactionId, tranData.payload.sourceAddress);
    lockMnemonic(transaction, transactionId, tranData.payload.storageDepositSourceAddress);

    return true;
  });

const emptyWalletResult = (): WalletResult => ({
  createdOn: serverTime(),
  processedOn: serverTime(),
  confirmed: false,
  chainReferences: [],
  count: 0,
});

const getMnemonic = async (
  transaction: admin.firestore.Transaction,
  address: string,
): Promise<Mnemonic> => {
  if (isEmpty(address)) {
    return {};
  }
  const docRef = admin.firestore().doc(`${COL.MNEMONIC}/${address}`);
  return (await transaction.get(docRef)).data() || {};
};

const lockMnemonic = (
  transaction: admin.firestore.Transaction,
  lockedBy: string,
  address: string,
) => {
  if (isEmpty(address)) {
    return;
  }
  const docRef = admin.firestore().doc(`${COL.MNEMONIC}/${address}`);
  transaction.update(docRef, {
    lockedBy,
    consumedOutputIds: [],
    consumedNftOutputIds: [],
    consumedAliasOutputIds: [],
  });
};

const mnemonicsAreLocked = async (transaction: admin.firestore.Transaction, tran: Transaction) => {
  const sourceAddressMnemonic = await getMnemonic(transaction, tran.payload.sourceAddress);
  const storageDepositSourceAddress = await getMnemonic(
    transaction,
    tran.payload.storageDepositSourceAddress,
  );
  return (
    (sourceAddressMnemonic.lockedBy || tran.uid) !== tran.uid ||
    (storageDepositSourceAddress.lockedBy || tran.uid) !== tran.uid
  );
};

const isConfirmed = (prev: Transaction | undefined, curr: Transaction | undefined) =>
  !prev?.payload?.walletReference?.confirmed && curr?.payload?.walletReference?.confirmed;

const onMintedAirdropCleared = async (curr: Transaction) => {
  const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${curr.member}`).get()).data();
  const credit = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: curr.space,
    member: curr.member,
    createdOn: serverTime(),
    network: curr.network || DEFAULT_NETWORK,
    payload: {
      amount: curr.payload.amount,
      sourceAddress: curr.payload.targetAddress,
      targetAddress: getAddress(member, curr.network || DEFAULT_NETWORK),
      sourceTransaction: [curr.uid],
      reconciled: true,
      void: false,
      token: curr.payload.token,
    },
  };
  await admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`).create(credit);
};

const confirmStaking = async (billPayment: Transaction) => {
  const stakeDocRef = admin.firestore().doc(`${COL.STAKE}/${billPayment.payload.stake}`);
  const stake = <Stake>(await stakeDocRef.get()).data();

  const batch = admin.firestore().batch();

  const updateData = {
    stakeAmount: admin.firestore.FieldValue.increment(stake.amount),
    stakeTotalAmount: admin.firestore.FieldValue.increment(stake.amount),
    stakeValue: admin.firestore.FieldValue.increment(stake.value),
    stakeTotalValue: admin.firestore.FieldValue.increment(stake.value),
  };

  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${billPayment.space}`);
  batch.update(spaceDocRef, updateData);

  const spaceMemberDocRef = admin
    .firestore()
    .doc(`${COL.SPACE}/${billPayment.space}/${SUB_COL.MEMBERS}/${billPayment.member}`);
  batch.update(spaceMemberDocRef, updateData);

  await batch.commit();
};
