import {
  COL,
  DEFAULT_NETWORK,
  DEF_WALLET_PAY_IN_PROGRESS,
  MAX_WALLET_RETRY,
  Member,
  Mnemonic,
  Network,
  Transaction,
  TransactionAwardType,
  TransactionMintCollectionType,
  TransactionMintTokenType,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
  WalletResult,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import admin, { arrayUnion } from '../../admin.config';
import { scale } from '../../scale.settings';
import { NativeTokenWallet } from '../../services/wallet/NativeTokenWallet';
import { NftWallet } from '../../services/wallet/NftWallet';
import { AliasWallet } from '../../services/wallet/smr-wallets/AliasWallet';
import { SmrParams, SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { getAddress } from '../../utils/address.utils';
import { isEmulatorEnv } from '../../utils/config.utils';
import { cOn, serverTime, uOn } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { unclockMnemonic } from '../milestone-transactions-triggers/common';
import { onAirdropClaim } from './airdrop.claim';
import { onAwardUpdate } from './award.transaction.update';
import { onCollectionMintingUpdate } from './collection-minting';
import { onNftStaked } from './nft-staked';
import { onProposalVoteCreditConfirmed } from './proposal.vote';
import { onStakingConfirmed } from './staking';
import { onTokenMintingUpdate } from './token-minting';
import { getWalletParams } from './wallet-params';

export const EXECUTABLE_TRANSACTIONS = [
  TransactionType.CREDIT,
  TransactionType.CREDIT_TANGLE_REQUEST,
  TransactionType.BILL_PAYMENT,
  TransactionType.MINT_COLLECTION,
  TransactionType.MINT_TOKEN,
  TransactionType.CREDIT_NFT,
  TransactionType.WITHDRAW_NFT,
  TransactionType.UNLOCK,
  TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED,
  TransactionType.AWARD,
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

    if (isCreate) {
      await change.after.ref.update(uOn({ isOrderType: curr.type === TransactionType.ORDER }));
    }

    if (isExecutableType && !curr?.ignoreWallet && (isCreate || shouldRetry)) {
      return await executeTransaction(curr.uid);
    }

    if (
      curr.payload.type === TransactionOrderType.AIRDROP_MINTED_TOKEN &&
      prev?.payload?.unclaimedAirdrops &&
      curr.payload.unclaimedAirdrops === 0
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
        .update(
          uOn({
            'payload.walletReference.confirmed': true,
            'payload.walletReference.inProgress': false,
            'payload.walletReference.count': admin.firestore.FieldValue.increment(1),
            'payload.walletReference.processedOn': admin.firestore.FieldValue.serverTimestamp(),
            'payload.walletReference.chainReference':
              curr.payload?.walletReference?.chainReference || '',
            'payload.walletReference.chainReferences': arrayUnion(
              curr.payload?.walletReference?.chainReference || '',
            ),
          }),
        );
      return;
    }

    if (
      curr.type === TransactionType.BILL_PAYMENT &&
      isConfirmed(prev, curr) &&
      !isEmpty(curr.payload.stake)
    ) {
      await onStakingConfirmed(curr);
      return;
    }

    const airdropOrderTypes = [
      TransactionOrderType.TOKEN_AIRDROP,
      TransactionOrderType.CLAIM_MINTED_TOKEN,
      TransactionOrderType.CLAIM_BASE_TOKEN,
    ];
    if (
      airdropOrderTypes.includes(curr.payload.type) &&
      !prev?.payload.reconciled &&
      curr.payload.reconciled
    ) {
      await onAirdropClaim(curr);
    }

    if (
      isConfirmed(prev, curr) &&
      curr.payload.proposalId &&
      curr.type === TransactionType.CREDIT
    ) {
      await onProposalVoteCreditConfirmed(curr);
    }

    if (
      isConfirmed(prev, curr) &&
      curr.payload.weeks &&
      curr.type === TransactionType.WITHDRAW_NFT
    ) {
      await onNftStaked(curr);
    }

    if (isConfirmed(prev, curr) && curr.type === TransactionType.AWARD) {
      await onAwardUpdate(curr);
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
        case TransactionType.CREDIT_TANGLE_REQUEST:
          return walletService.send(
            sourceAddress,
            payload.targetAddress,
            payload.amount,
            params,
            transaction.payload.outputToConsume,
          );
        case TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED:
          return (walletService as SmrWallet).creditLocked(transaction, params);

        case TransactionType.MINT_COLLECTION:
          return submitCollectionMintTransactions(transaction, walletService as SmrWallet, params);

        case TransactionType.MINT_TOKEN:
          return submitTokenMintTransactions(transaction, walletService as SmrWallet, params);

        case TransactionType.AWARD:
          return submitCreateAwardTransaction(transaction, walletService as SmrWallet, params);

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
    await docRef.update(
      uOn({
        'payload.walletReference.processedOn': admin.firestore.FieldValue.serverTimestamp(),
        'payload.walletReference.chainReference': chainReference,
        'payload.walletReference.chainReferences': arrayUnion(chainReference),
      }),
    );
  } catch (error) {
    functions.logger.error(transaction.uid, error);
    await docRef.update(
      uOn({
        'payload.walletReference.chainReference': null,
        'payload.walletReference.processedOn': admin.firestore.FieldValue.serverTimestamp(),
        'payload.walletReference.error': JSON.stringify(error),
      }),
    );
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
    case TransactionMintCollectionType.SEND_ALIAS_TO_GUARDIAN: {
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
    case TransactionMintTokenType.SEND_ALIAS_TO_GUARDIAN: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.changeAliasOwner(transaction, params);
    }
    default: {
      functions.logger.error('Unsupported executable transaction type', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const submitCreateAwardTransaction = (
  transaction: Transaction,
  wallet: SmrWallet,
  params: SmrParams,
) => {
  switch (transaction.payload.type) {
    case TransactionAwardType.MINT_ALIAS: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.mintAlias(transaction, params);
    }
    case TransactionAwardType.MINT_COLLECTION: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintAwardCollection(transaction, params);
    }
    case TransactionAwardType.BADGE: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintNtt(transaction, params);
    }
    case TransactionAwardType.BURN_ALIAS: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.burnAlias(transaction, params);
    }
    default: {
      functions.logger.error(
        'Unsupported executable transaction type in submitCreateAwardTransaction',
        transaction,
      );
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
    case TransactionUnlockType.UNLOCK_FUNDS:
    case TransactionUnlockType.TANGLE_TRANSFER: {
      const sourceAddress = await wallet.getAddressDetails(transaction.payload.sourceAddress);
      return wallet.send(
        sourceAddress,
        transaction.payload.targetAddress,
        transaction.payload.amount,
        params,
        transaction.payload.outputToConsume,
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
      isEmulatorEnv() &&
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
      transaction.update(docRef, uOn({ shouldRetry: false }));
      return false;
    }

    if (
      (await mnemonicsAreLocked(transaction, tranData)) ||
      tranData.payload.dependsOnBillPayment
    ) {
      walletResponse.chainReference = null;
      transaction.update(
        docRef,
        uOn({
          shouldRetry: false,
          'payload.walletReference': walletResponse,
          'payload.dependsOnBillPayment': false,
        }),
      );
      return false;
    }

    walletResponse.error = null;
    walletResponse.chainReference = DEF_WALLET_PAY_IN_PROGRESS + Date.now();
    walletResponse.count = walletResponse.count + 1;
    walletResponse.processedOn = serverTime();
    walletResponse.inProgress = true;

    transaction.update(
      docRef,
      uOn({ shouldRetry: false, 'payload.walletReference': walletResponse }),
    );

    if (!tranData.payload.outputToConsume) {
      lockMnemonic(transaction, transactionId, tranData.payload.sourceAddress);
      lockMnemonic(transaction, transactionId, tranData.payload.storageDepositSourceAddress);
    }

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
  transaction.update(
    docRef,
    uOn({
      lockedBy,
      consumedOutputIds: [],
      consumedNftOutputIds: [],
      consumedAliasOutputIds: [],
    }),
  );
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
  await admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`).create(cOn(credit));
};
