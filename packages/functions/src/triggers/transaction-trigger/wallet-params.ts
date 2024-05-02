import { build5Db } from '@build-5/database';
import {
  COL,
  IOTATangleTransaction,
  NativeToken,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { WalletParams } from '../../services/wallet/wallet';
import { isProdEnv } from '../../utils/config.utils';

export const getWalletParams = async (transaction: Transaction): Promise<WalletParams> => ({
  ...(await getParams(transaction)),
  nativeTokens: transaction.payload.nativeTokens?.map((nt: NativeToken) => ({
    id: nt.id,
    amount: BigInt(Number(nt.amount)),
  })),
  storageDepositSourceAddress: transaction.payload.storageDepositSourceAddress,
  vestingAt: transaction.payload.vestingAt,
  storageDepositReturnAddress: transaction.payload.storageReturn?.address,
  customMetadata: transaction.payload.customMetadata,
  tag: transaction.payload.tag,
});

const getParams = async (transaction: Transaction) => {
  const payload = transaction.payload;
  const details = <IOTATangleTransaction>{};
  details.tranId = transaction.uid;
  details.network = isProdEnv() ? 'soon' : 'wen';
  if (transaction.type === TransactionType.BILL_PAYMENT) {
    details.payment = true;

    details.previousOwner = payload.previousOwner || null;
    details.previousOwnerEntity = payload.previousOwnerEntity || null;
    details.owner = payload.owner || null;
    details.ownerEntity = payload.ownerEntity || null;

    if (payload.royalty) {
      details.royalty = payload.royalty;
    }
    if (payload.collection) {
      details.collection = payload.collection;
    }
    if (payload.nft) {
      details.nft = payload.nft;
      const nft = await build5Db().doc(COL.NFT, payload.nft).get();
      if (nft && nft.ipfsMedia) {
        details.ipfsMedia = 'ipfs://' + nft.ipfsMedia;
      }
      if (nft && nft.ipfsMetadata) {
        details.ipfsMetadata = nft.ipfsMetadata;
      }
    }
    if (payload.token) {
      details.token = payload.token;
      details.tokenSymbol = payload.tokenSymbol || '';
      details.quantity = payload.quantity || 0;
    }
  }

  if (transaction.type === TransactionType.CREDIT) {
    details.refund = true;
    details.invalidPayment = transaction.payload.invalidPayment || false;
  }

  if (transaction.member) {
    details.member = transaction.member;
  } else if (transaction.space) {
    details.space = transaction.space;
  }
  if (transaction.payload.response) {
    details.response = transaction.payload.response;
  }
  return { data: JSON.stringify(details) };
};
