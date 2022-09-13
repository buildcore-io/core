import { HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import { Entity, IOTATangleTransaction, Network, Transaction, TransactionType } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { NativeToken } from "../../../interfaces/models/milestone";
import { Nft } from "../../../interfaces/models/nft";
import admin from "../../admin.config";
import { isProdEnv } from "../../utils/config.utils";

export const getWalletParams = (transaction: Transaction, network: Network) => {
  switch (network) {
    case Network.SMR:
    case Network.RMS:
      return getShimmerParams(transaction)
    default: return getIotaParams(transaction)
  }
}

const getShimmerParams = async (transaction: Transaction) => ({
  data: JSON.stringify({ tranId: transaction.uid }),
  nativeTokens: transaction.payload.nativeTokens?.map((nt: NativeToken) => ({ id: nt.id, amount: HexHelper.fromBigInt256(bigInt(nt.amount)) })),
  storageDepositSourceAddress: transaction.payload.storageDepositSourceAddress,
  vestingAt: transaction.payload.vestingAt,
  storageDepositReturnAddress: transaction.payload.storageReturn?.address
})

const getIotaParams = async (transaction: Transaction) => {
  const payload = transaction.payload
  const details = <IOTATangleTransaction>{};
  details.tranId = transaction.uid;
  details.network = isProdEnv() ? 'soon' : 'wen';
  if (transaction.type === TransactionType.BILL_PAYMENT) {
    details.payment = true;

    // Once space can own NFT this will be expanded.
    if (transaction.member) {
      details.previousOwner = payload.previousOwner;
      details.previousOwnerEntity = payload.previousOwnerEntity;
      details.owner = transaction.member;
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

  if (transaction.type === TransactionType.CREDIT) {
    details.refund = true;
    if (transaction.member) {
      details.member = transaction.member;
    } else if (transaction.space) {
      details.space = transaction.space;
    }
  }
  return { data: JSON.stringify(details) }
}
