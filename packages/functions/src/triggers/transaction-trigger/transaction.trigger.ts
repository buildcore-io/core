import { ITransaction, PgTransaction, database } from '@buildcore/database';
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
} from '@buildcore/interfaces';
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
import { logger } from '../../utils/logger';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { PgDocEvent } from '../common';
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

export const onTransactionWrite = async (event: PgDocEvent<PgTransaction>) => {
  const { prev, curr } = event;
  if (!curr) {
    return;
  }

  const type = curr.type as TransactionType;
  const isExecutableType = EXECUTABLE_TRANSACTIONS.includes(type);
  const isCreate = prev === undefined;
  const shouldRetry = !prev?.shouldRetry && curr?.shouldRetry;

  if (isCreate) {
    const docRef = database().doc(COL.TRANSACTION, curr.uid);
    await docRef.update({ isOrderType: type === TransactionType.ORDER });
  }

  if (isExecutableType && !curr?.ignoreWallet && (isCreate || shouldRetry)) {
    return await executeTransaction(curr.uid);
  }

  if (
    curr.payload_type === TransactionPayloadType.AIRDROP_MINTED_TOKEN &&
    prev?.payload_unclaimedAirdrops &&
    curr.payload_unclaimedAirdrops === 0
  ) {
    await onMintedAirdropCleared(curr);
    return;
  }

  if (type === TransactionType.MINT_COLLECTION && isConfirmed(prev, curr)) {
    await onCollectionMintingUpdate(curr);
    return;
  }

  if (type === TransactionType.MINT_TOKEN && isConfirmed(prev, curr)) {
    await onTokenMintingUpdate(curr);
    return;
  }

  if (type === TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED && isConfirmed(prev, curr)) {
    await database()
      .doc(COL.TRANSACTION, curr.payload_transaction!)
      .update({
        payload_walletReference_confirmed: true,
        payload_walletReference_inProgress: false,
        payload_walletReference_count: database().inc(1),
        payload_walletReference_processedOn: dayjs().toDate(),
        payload_walletReference_chainReference: curr.payload_walletReference_chainReference || '',
        payload_walletReference_chainReferences: database().arrayUnion(
          curr.payload_walletReference_chainReference || '',
        ),
      });
    return;
  }

  if (
    type === TransactionType.BILL_PAYMENT &&
    isConfirmed(prev, curr) &&
    !isEmpty(curr.payload_stake)
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
    airdropOrderTypes.includes(curr.payload_type! as TransactionPayloadType) &&
    !prev?.payload_reconciled &&
    curr.payload_reconciled
  ) {
    await onAirdropClaim(curr);
    return;
  }

  if (isConfirmed(prev, curr) && curr.payload_proposalId && type === TransactionType.CREDIT) {
    await onProposalVoteCreditConfirmed(curr);
    return;
  }

  if (isConfirmed(prev, curr) && curr.payload_weeks && type === TransactionType.WITHDRAW_NFT) {
    await onNftStaked(curr);
    return;
  }

  if (isConfirmed(prev, curr) && type === TransactionType.AWARD) {
    await onAwardUpdate(curr);
    return;
  }

  if (isConfirmed(prev, curr) && type === TransactionType.METADATA_NFT) {
    await onMetadataNftMintUpdate(curr);
    return;
  }

  if (isConfirmed(prev, curr) && type === TransactionType.METADATA_NFT) {
    await onMetadataNftMintUpdate(curr);
    return;
  }

  if (isConfirmed(prev, curr) && type === TransactionType.STAMP) {
    await onStampMintUpdate(curr);
    return;
  }

  if (
    isConfirmed(prev, curr) &&
    curr.payload_award &&
    curr.payload_type === TransactionPayloadType.MINTED_AIRDROP_CLAIM
  ) {
    const awardDocRef = database().doc(COL.AWARD, curr.payload_award);
    await awardDocRef.update({ airdropClaimed: database().inc(1) });
  }
};

const executeTransaction = async (transactionId: string) => {
  const shouldProcess = await prepareTransaction(transactionId);
  if (!shouldProcess) {
    return;
  }

  const docRef = database().doc(COL.TRANSACTION, transactionId);
  const transaction = (await docRef.get())!;
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
          logger.error('Unsupported executable transaction type error', transaction);
          throw Error('Unsupported executable transaction type ' + transaction.type);
        }
      }
    };

    const chainReference = await submit();
    await docRef.update({
      payload_walletReference_processedOn: dayjs().toDate(),
      payload_walletReference_chainReference: chainReference,
      payload_walletReference_chainReferences: database().arrayUnion(chainReference),
      payload_walletReference_nodeIndex: wallet.nodeIndex,
    });
  } catch (error) {
    logger.error('onTransactionWrite-error', transaction.uid, wallet.nodeUrl, error);
    await docRef.update({
      payload_walletReference_chainReference: null,
      payload_walletReference_processedOn: dayjs().toDate(),
      payload_walletReference_error: JSON.stringify(error),
      payload_walletReference_nodeIndex: wallet.nodeIndex,
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
      logger.error('Unsupported executable transaction type error', transaction);
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
      logger.error('Unsupported executable transaction type error', transaction);
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
      logger.error(
        'Unsupported executable transaction type in submitCreateAwardTransaction - error',
        transaction,
      );
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const submitMintMetadataTransaction = (
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
      logger.error(
        'Unsupported executable transaction type in submitMintMetadataTransaction - error',
        transaction,
      );
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const submitMintStampTransaction = (
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
      logger.error(
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
      logger.error('Unsupported executable transaction type - error', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.payload.type);
    }
  }
};

const prepareTransaction = (transactionId: string) =>
  database().runTransaction(async (transaction) => {
    const docRef = database().doc(COL.TRANSACTION, transactionId);
    const tranData = await transaction.get(docRef);
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
      await transaction.update(docRef, { shouldRetry: false });
      return false;
    }

    if (
      (await mnemonicsAreLocked(transaction, tranData)) ||
      tranData.payload.dependsOnBillPayment
    ) {
      walletResponse.chainReference = null;
      await transaction.update(docRef, {
        shouldRetry: false,
        payload_walletReference_createdOn: walletResponse.createdOn?.toDate(),
        payload_walletReference_processedOn: walletResponse.processedOn?.toDate(),
        payload_walletReference_chainReference: walletResponse.chainReference || undefined,
        payload_walletReference_chainReferences: walletResponse.chainReferences,
        payload_walletReference_error: walletResponse.error as string,
        payload_walletReference_confirmed: walletResponse.confirmed,
        payload_walletReference_confirmedOn: walletResponse.confirmedOn?.toDate(),
        payload_walletReference_milestoneTransactionPath: walletResponse.milestoneTransactionPath,
        payload_walletReference_count: walletResponse.count,
        payload_walletReference_inProgress: walletResponse.inProgress,
        payload_walletReference_nodeIndex: walletResponse.nodeIndex,
        payload_dependsOnBillPayment: false,
      });
      return false;
    }

    walletResponse.error = null;
    walletResponse.chainReference = DEF_WALLET_PAY_IN_PROGRESS + Date.now();
    walletResponse.count = walletResponse.count + 1;
    walletResponse.processedOn = serverTime();
    walletResponse.inProgress = true;

    await transaction.update(docRef, {
      shouldRetry: false,
      payload_walletReference_createdOn: walletResponse.createdOn?.toDate(),
      payload_walletReference_processedOn: walletResponse.processedOn?.toDate(),
      payload_walletReference_chainReference: walletResponse.chainReference || undefined,
      payload_walletReference_chainReferences: walletResponse.chainReferences,
      payload_walletReference_error: walletResponse.error as string,
      payload_walletReference_confirmed: walletResponse.confirmed,
      payload_walletReference_confirmedOn: walletResponse.confirmedOn?.toDate(),
      payload_walletReference_milestoneTransactionPath: walletResponse.milestoneTransactionPath,
      payload_walletReference_count: walletResponse.count,
      payload_walletReference_inProgress: walletResponse.inProgress,
      payload_walletReference_nodeIndex: walletResponse.nodeIndex,
    });

    if (!tranData.payload.outputToConsume) {
      await lockMnemonic(transaction, transactionId, tranData.payload.sourceAddress);
      await lockMnemonic(transaction, transactionId, tranData.payload.storageDepositSourceAddress);
      await lockMnemonic(transaction, transactionId, tranData.payload.aliasGovAddress);
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
    return {} as Mnemonic;
  }
  const docRef = database().doc(COL.MNEMONIC, address!);
  return (await transaction.get(docRef)) || ({} as Mnemonic);
};

const lockMnemonic = async (
  transaction: ITransaction,
  lockedBy: string,
  address: NetworkAddress | undefined,
) => {
  if (isEmpty(address)) {
    return;
  }
  const docRef = database().doc(COL.MNEMONIC, address!);
  await transaction.update(docRef, {
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

const isConfirmed = (prev: PgTransaction | undefined, curr: PgTransaction | undefined) =>
  !prev?.payload_walletReference_confirmed && curr?.payload_walletReference_confirmed;

const onMintedAirdropCleared = async (curr: PgTransaction) => {
  const network = (curr.network as Network) || DEFAULT_NETWORK;
  const member = <Member>await database().doc(COL.MEMBER, curr.member!).get();
  const credit: Transaction = {
    project: getProject(curr),
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: curr.space,
    member: curr.member,
    network,
    payload: {
      type: TransactionPayloadType.AIRDROP_MINTED_TOKEN,
      amount: curr.payload_amount,
      sourceAddress: curr.payload_targetAddress,
      targetAddress: getAddress(member, network),
      sourceTransaction: [curr.uid],
      reconciled: true,
      void: false,
      token: curr.payload_token,
    },
  };
  await database().doc(COL.TRANSACTION, credit.uid).create(credit);
};
