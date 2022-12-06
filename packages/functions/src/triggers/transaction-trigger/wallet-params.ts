import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  IOTATangleTransaction,
  NativeToken,
  Network,
  Nft,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import admin from '../../admin.config';
import { isProdEnv } from '../../utils/config.utils';

export const getWalletParams = (transaction: Transaction, network: Network) => {
  switch (network) {
    case Network.SMR:
    case Network.RMS:
      return getShimmerParams(transaction);
    default:
      return getParams(transaction);
  }
};

const getShimmerParams = async (transaction: Transaction) => ({
  ...(await getParams(transaction)),
  nativeTokens: transaction.payload.nativeTokens?.map((nt: NativeToken) => ({
    id: nt.id,
    amount: HexHelper.fromBigInt256(bigInt(Number(nt.amount))),
  })),
  storageDepositSourceAddress: transaction.payload.storageDepositSourceAddress,
  vestingAt: transaction.payload.vestingAt,
  storageDepositReturnAddress: transaction.payload.storageReturn?.address,
  customMetadata: transaction.payload.customMetadata,
});

const getParams = async (transaction: Transaction) => {
  const payload = transaction.payload;
  const details = <IOTATangleTransaction>{};
  details.tranId = transaction.uid;
  details.network = isProdEnv() ? 'soon' : 'wen';
  if (transaction.type === TransactionType.BILL_PAYMENT) {
    details.payment = true;

    details.previousOwner = payload.previousOwner || '';
    details.previousOwnerEntity = payload.previousOwnerEntity || '';
    details.owner = payload.owner || '';
    details.ownerEntity = payload.ownerEntity || '';

    if (payload.royalty) {
      details.royalty = payload.royalty;
    }
    if (payload.collection) {
      details.collection = payload.collection;
    }
    if (payload.nft) {
      details.nft = payload.nft;
      const nft = <Nft | undefined>(
        (await admin.firestore().doc(`${COL.NFT}/${payload.nft}`).get()).data()
      );
      if (nft && nft.ipfsMedia) {
        details.ipfsMedia = 'ipfs://' + nft.ipfsMedia;
      }
      if (nft && nft.ipfsMetadata) {
        details.ipfsMetadata = nft.ipfsMetadata;
      }
    }
    if (payload.token) {
      details.token = payload.token;
      details.quantity = payload.quantity || 0;
    }
  }

  if (transaction.type === TransactionType.CREDIT) {
    details.refund = true;
  }

  if (transaction.member) {
    details.member = transaction.member;
  } else if (transaction.space) {
    details.space = transaction.space;
  }
  return { data: JSON.stringify(details) };
};
