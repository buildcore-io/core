import { ITransaction, build5Db } from '@build-5/database';
import {
  COL,
  DEFAULT_NETWORK,
  DEF_WALLET_PAY_IN_PROGRESS,
  MAX_WALLET_RETRY,
  Member,
  Mnemonic,
  Network,
  NetworkAddress,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WalletResult,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { AliasWallet } from '../../services/wallet/AliasWallet';
import { NativeTokenWallet } from '../../services/wallet/NativeTokenWallet';
import { NftWallet } from '../../services/wallet/NftWallet';
import { Wallet, WalletParams } from '../../services/wallet/wallet';
import { WalletService } from '../../services/wallet/wallet.service';
import { getAddress } from '../../utils/address.utils';
import { getProject } from '../../utils/common.utils';
import { isEmulatorEnv } from '../../utils/config.utils';
import { serverTime } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { FirestoreDocEvent } from '../common';
import { unclockMnemonic } from '../milestone-transactions-triggers/common';
import { onAirdropClaim } from './airdrop.claim';
import { onAwardUpdate } from './award.transaction.update';
import { onCollectionMintingUpdate } from './collection-minting';
import { onMetadataNftMintUpdate } from './matadatNft-minting';
import { onNftStaked } from './nft-staked';
import { onProposalVoteCreditConfirmed } from './proposal.vote';
import { onStakingConfirmed } from './staking';
import { onStampMintUpdate } from './stamp-minting';
import { onTokenMintingUpdate } from './token-minting';
import { getWalletParams } from './wallet-params';

export const DEFAULT_EXECUTABLE_TRANSACTIONS = [
  TransactionType.BILL_PAYMENT,
  TransactionType.MINT_COLLECTION,
  TransactionType.MINT_TOKEN,
  TransactionType.CREDIT_NFT,
  TransactionType.WITHDRAW_NFT,
  TransactionType.UNLOCK,
  TransactionType.AWARD,
  TransactionType.METADATA_NFT,
  TransactionType.STAMP,
];

export const CREDIT_EXECUTABLE_TRANSACTIONS = [
  TransactionType.CREDIT,
  TransactionType.CREDIT_TANGLE_REQUEST,
  TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED,
];

export const EXECUTABLE_TRANSACTIONS = [
  ...DEFAULT_EXECUTABLE_TRANSACTIONS,
  ...CREDIT_EXECUTABLE_TRANSACTIONS,
];

export const onTransactionWrite = async (event: FirestoreDocEvent<Transaction>) => {
  const { prev, curr } = event;
  if (!curr) {
    return;
  }

  const isExecutableType = EXECUTABLE_TRANSACTIONS.includes(curr.type);
  const isCreate = prev === undefined;
  const shouldRetry = !prev?.shouldRetry && curr?.shouldRetry;

  if (isCreate) {
    const docRef = build5Db().doc(`${COL.TRANSACTION}/${curr.uid}`);
    await docRef.update({ isOrderType: curr.type === TransactionType.ORDER });
  }

  if (isExecutableType && !curr?.ignoreWallet && (isCreate || shouldRetry)) {
    return await executeTransaction(curr.uid);
  }

  if (
    curr.payload.type === TransactionPayloadType.AIRDROP_MINTED_TOKEN &&
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
    await build5Db()
      .doc(`${COL.TRANSACTION}/${curr.payload.transaction}`)
      .update({
        'payload.walletReference.confirmed': true,
        'payload.walletReference.inProgress': false,
        'payload.walletReference.count': build5Db().inc(1),
        'payload.walletReference.processedOn': dayjs().toDate(),
        'payload.walletReference.chainReference':
          curr.payload?.walletReference?.chainReference || '',
        'payload.walletReference.chainReferences': build5Db().arrayUnion(
          curr.payload?.walletReference?.chainReference || '',
        ),
      });
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
    TransactionPayloadType.TOKEN_AIRDROP,
    TransactionPayloadType.CLAIM_MINTED_TOKEN,
    TransactionPayloadType.CLAIM_BASE_TOKEN,
  ];
  if (
    airdropOrderTypes.includes(curr.payload.type!) &&
    !prev?.payload.reconciled &&
    curr.payload.reconciled
  ) {
    console.info('onAirdropClaim', JSON.stringify(prev), JSON.stringify(curr));
    await onAirdropClaim(curr);
    return;
  }

  if (isConfirmed(prev, curr) && curr.payload.proposalId && curr.type === TransactionType.CREDIT) {
    await onProposalVoteCreditConfirmed(curr);
    return;
  }

  if (isConfirmed(prev, curr) && curr.payload.weeks && curr.type === TransactionType.WITHDRAW_NFT) {
    await onNftStaked(curr);
    return;
  }

  if (isConfirmed(prev, curr) && curr.type === TransactionType.AWARD) {
    await onAwardUpdate(curr);
    return;
  }

  if (isConfirmed(prev, curr) && curr.type === TransactionType.METADATA_NFT) {
    await onMetadataNftMintUpdate(curr);
    return;
  }

  if (isConfirmed(prev, curr) && curr.type === TransactionType.METADATA_NFT) {
    await onMetadataNftMintUpdate(curr);
    return;
  }

  if (isConfirmed(prev, curr) && curr.type === TransactionType.STAMP) {
    await onStampMintUpdate(curr);
    return;
  }

  if (
    isConfirmed(prev, curr) &&
    curr.payload.award &&
    curr.payload.type === TransactionPayloadType.MINTED_AIRDROP_CLAIM
  ) {
    const awardDocRef = build5Db().doc(`${COL.AWARD}/${curr.payload.award}`);
    await awardDocRef.update({ airdropClaimed: build5Db().inc(1) });
  }
};

const executeTransaction = async (transactionId: string) => {
  const shouldProcess = await prepareTransaction(transactionId);
  if (!shouldProcess) {
    return;
  }

  const docRef = build5Db().doc(`${COL.TRANSACTION}/${transactionId}`);
  const transaction = (await docRef.get<Transaction>())!;
  const payload = transaction.payload;

  const params = await getWalletParams(transaction);

  const wallet = await WalletService.newWallet(
    transaction.network,
    transaction.payload.walletReference?.nodeIndex,
  );
  try {
    const sourceAddress = await wallet.getAddressDetails(payload.sourceAddress!);

    const submit = () => {
      switch (transaction.type) {
        case TransactionType.BILL_PAYMENT:
        case TransactionType.CREDIT:
        case TransactionType.CREDIT_TANGLE_REQUEST:
          return wallet.send(
            sourceAddress,
            payload.targetAddress!,
            payload.amount!,
            params,
            transaction.payload.outputToConsume,
          );
        case TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED:
          return wallet.creditLocked(transaction, params);

        case TransactionType.MINT_COLLECTION:
          return submitCollectionMintTransactions(transaction, wallet, params);

        case TransactionType.MINT_TOKEN:
          return submitTokenMintTransactions(transaction, wallet, params);

        case TransactionType.AWARD:
          return submitCreateAwardTransaction(transaction, wallet, params);

        case TransactionType.METADATA_NFT:
          return submitMintMetadataTransaction(transaction, wallet, params);

        case TransactionType.STAMP:
          return submitMintStampTransaction(transaction, wallet, params);

        case TransactionType.CREDIT_NFT:
        case TransactionType.WITHDRAW_NFT: {
          const nftWallet = new NftWallet(wallet);
          return nftWallet.changeNftOwner(transaction, params);
        }

        case TransactionType.UNLOCK: {
          return submitUnlockTransaction(transaction, wallet, params);
        }

        default: {
          console.error('Unsupported executable transaction type error', transaction);
          throw Error('Unsupported executable transaction type ' + transaction.type);
        }
      }
    };

    const chainReference = await submit();
    await docRef.update({
      'payload.walletReference.processedOn': dayjs().toDate(),
      'payload.walletReference.chainReference': chainReference,
      'payload.walletReference.chainReferences': build5Db().arrayUnion(chainReference),
      'payload.walletReference.nodeIndex': wallet.nodeIndex,
    });
  } catch (error) {
    console.error('onTransactionWrite-error', transaction.uid, wallet.nodeUrl, error);
    await docRef.update({
      'payload.walletReference.chainReference': null,
      'payload.walletReference.processedOn': dayjs().toDate(),
      'payload.walletReference.error': JSON.stringify(error),
      'payload.walletReference.nodeIndex': wallet.nodeIndex,
    });
    await unclockMnemonic(payload.sourceAddress!);
  }
};

const submitCollectionMintTransactions = (
  transaction: Transaction,
  wallet: Wallet,
  params: WalletParams,
) => {
  switch (transaction.payload.type) {
    case TransactionPayloadType.MINT_ALIAS: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.mintAlias(transaction, params);
    }
    case TransactionPayloadType.MINT_COLLECTION: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintCollection(transaction, params);
    }
    case TransactionPayloadType.MINT_NFTS: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintNfts(transaction, params);
    }
    case TransactionPayloadType.LOCK_COLLECTION: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.lockCollection(transaction, params);
    }
    case TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.changeAliasOwner(transaction, params);
    }
    default: {
      console.error('Unsupported executable transaction type error', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const submitTokenMintTransactions = (
  transaction: Transaction,
  wallet: Wallet,
  params: WalletParams,
) => {
  switch (transaction.payload.type) {
    case TransactionPayloadType.MINT_ALIAS: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.mintAlias(transaction, params);
    }
    case TransactionPayloadType.MINT_FOUNDRY: {
      const nativeTokenWallet = new NativeTokenWallet(wallet);
      return nativeTokenWallet.mintFoundry(transaction, params);
    }
    case TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.changeAliasOwner(transaction, params);
    }
    default: {
      console.error('Unsupported executable transaction type error', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const submitCreateAwardTransaction = (
  transaction: Transaction,
  wallet: Wallet,
  params: WalletParams,
) => {
  switch (transaction.payload.type) {
    case TransactionPayloadType.MINT_ALIAS: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.mintAlias(transaction, params);
    }
    case TransactionPayloadType.MINT_COLLECTION: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintAwardCollection(transaction, params);
    }
    case TransactionPayloadType.BADGE: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintNtt(transaction, params);
    }
    case TransactionPayloadType.BURN_ALIAS: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.burnAlias(transaction, params);
    }
    default: {
      console.error(
        'Unsupported executable transaction type in submitCreateAwardTransaction - error',
        transaction,
      );
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const submitMintMetadataTransaction = async (
  transaction: Transaction,
  wallet: Wallet,
  params: WalletParams,
) => {
  switch (transaction.payload.type) {
    case TransactionPayloadType.MINT_ALIAS: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.mintAlias(transaction, params);
    }
    case TransactionPayloadType.MINT_COLLECTION: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintCollection(transaction, params);
    }
    case TransactionPayloadType.MINT_NFT: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintMetadataNft(transaction, params);
    }
    case TransactionPayloadType.UPDATE_MINTED_NFT: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.updateMetadataNft(transaction, params);
    }
    default: {
      console.error(
        'Unsupported executable transaction type in submitMintMetadataTransaction - error',
        transaction,
      );
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const submitMintStampTransaction = async (
  transaction: Transaction,
  wallet: Wallet,
  params: WalletParams,
) => {
  switch (transaction.payload.type) {
    case TransactionPayloadType.MINT_ALIAS: {
      const aliasWallet = new AliasWallet(wallet);
      return aliasWallet.mintAlias(transaction, params);
    }
    case TransactionPayloadType.MINT_NFT: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.mintStampNft(transaction, params);
    }
    default: {
      console.error(
        'Unsupported executable transaction type in submitCreateAwardTransaction - error',
        transaction,
      );
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const submitUnlockTransaction = async (
  transaction: Transaction,
  wallet: Wallet,
  params: WalletParams,
) => {
  switch (transaction.payload.type) {
    case TransactionPayloadType.UNLOCK_FUNDS:
    case TransactionPayloadType.TANGLE_TRANSFER: {
      const sourceAddress = await wallet.getAddressDetails(transaction.payload.sourceAddress!);
      return wallet.send(
        sourceAddress,
        transaction.payload.targetAddress!,
        transaction.payload.amount!,
        params,
        transaction.payload.outputToConsume,
      );
    }
    case TransactionPayloadType.TANGLE_TRANSFER_MANY: {
      const sourceAddress = await wallet.getAddressDetails(transaction.payload.sourceAddress!);
      return wallet.sendToMany(sourceAddress, transaction.payload.targetAddresses!, params);
    }
    case TransactionPayloadType.UNLOCK_NFT: {
      const nftWallet = new NftWallet(wallet);
      return nftWallet.changeNftOwner(transaction, params);
    }
    default: {
      console.error('Unsupported executable transaction type - error', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const prepareTransaction = (transactionId: string) =>
  build5Db().runTransaction(async (transaction) => {
    const docRef = build5Db().doc(`${COL.TRANSACTION}/${transactionId}`);
    const tranData = await transaction.get<Transaction>(docRef);
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

    if (!tranData.payload.outputToConsume) {
      lockMnemonic(transaction, transactionId, tranData.payload.sourceAddress);
      lockMnemonic(transaction, transactionId, tranData.payload.storageDepositSourceAddress);
      lockMnemonic(transaction, transactionId, tranData.payload.aliasGovAddress);
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
  transaction: ITransaction,
  address: NetworkAddress | undefined,
): Promise<Mnemonic> => {
  if (isEmpty(address)) {
    return {};
  }
  const docRef = build5Db().doc(`${COL.MNEMONIC}/${address}`);
  return (await transaction.get(docRef)) || {};
};

const lockMnemonic = (
  transaction: ITransaction,
  lockedBy: string,
  address: NetworkAddress | undefined,
) => {
  if (isEmpty(address)) {
    return;
  }
  const docRef = build5Db().doc(`${COL.MNEMONIC}/${address}`);
  transaction.update(docRef, {
    lockedBy,
    consumedOutputIds: [],
    consumedNftOutputIds: [],
    consumedAliasOutputIds: [],
  });
};

const mnemonicsAreLocked = async (transaction: ITransaction, tran: Transaction) => {
  const sourceAddressMnemonic = await getMnemonic(transaction, tran.payload.sourceAddress);
  const storageDepositSourceAddress = await getMnemonic(
    transaction,
    tran.payload.storageDepositSourceAddress,
  );
  const aliasGovAddress = await getMnemonic(transaction, tran.payload.aliasGovAddress);
  return (
    (sourceAddressMnemonic.lockedBy || tran.uid) !== tran.uid ||
    (storageDepositSourceAddress.lockedBy || tran.uid) !== tran.uid ||
    (aliasGovAddress.lockedBy || tran.uid) !== tran.uid
  );
};

const isConfirmed = (prev: Transaction | undefined, curr: Transaction | undefined) =>
  !prev?.payload?.walletReference?.confirmed && curr?.payload?.walletReference?.confirmed;

const onMintedAirdropCleared = async (curr: Transaction) => {
  const member = <Member>await build5Db().doc(`${COL.MEMBER}/${curr.member}`).get();
  const credit: Transaction = {
    project: getProject(curr),
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: curr.space,
    member: curr.member,
    network: curr.network || DEFAULT_NETWORK,
    payload: {
      type: TransactionPayloadType.AIRDROP_MINTED_TOKEN,
      amount: curr.payload.amount,
      sourceAddress: curr.payload.targetAddress,
      targetAddress: getAddress(member, curr.network || DEFAULT_NETWORK),
      sourceTransaction: [curr.uid],
      reconciled: true,
      void: false,
      token: curr.payload.token,
    },
  };
  await build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`).create(credit);
};
