import {
  BaseTangleResponse,
  COL,
  Collection,
  CollectionStatus,
  Entity,
  MIN_AMOUNT_TO_TRANSFER,
  Member,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  Nft,
  NftAccess,
  Space,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import { assertMemberHasValidAddress, getAddress } from '../../../../utils/address.utils';
import { getRestrictions } from '../../../../utils/common.utils';
import { isProdEnv } from '../../../../utils/config.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertIpNotBlocked } from '../../../../utils/ip.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getSpace } from '../../../../utils/space.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet';
import { TransactionService } from '../../transaction-service';
import { nftBidSchema } from './NftBidTangleRequestSchema';
import { AVAILABLE_NETWORKS } from '../../../../controls/common';
import { build5Db } from '@build-5/database';

export class TangleNftBidService {
  constructor(readonly transactionService: TransactionService) {}

  public handleNftBid = async (
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
  ): Promise<BaseTangleResponse | undefined> => {
    const params = await assertValidationAsync(nftBidSchema, request);

    const order = await createNftBidOrder(params.nft, owner, '');
    order.payload.tanglePuchase = true;
    order.payload.disableWithdraw = params.disableWithdraw || false;

    this.transactionService.push({
      ref: build5Db().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });

    const isMintedNft = AVAILABLE_NETWORKS.includes(order.network!);
    if (!isMintedNft) {
      return {
        status: 'success',
        amount: order.payload.amount!,
        address: order.payload.targetAddress!,
      };
    }

    this.transactionService.createUnlockTransaction(
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );
    return;
  };
}

export const createNftBidOrder = async (
  nftId: string,
  owner: string,
  ip = '',
): Promise<Transaction> => {
  const nftDocRef = build5Db().doc(`${COL.NFT}/${nftId}`);
  const nft = await nftDocRef.get<Nft>();
  if (!nft) {
    throw invalidArgument(WenError.nft_does_not_exists);
  }

  if (isProdEnv()) {
    await assertIpNotBlocked(ip, nftId, 'nft');
  }

  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nft.collection}`);
  const collection = (await collectionDocRef.get<Collection>())!;

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${collection.space}`);
  const space = await spaceDocRef.get<Space>();

  if (!collection.approved) {
    throw invalidArgument(WenError.collection_must_be_approved);
  }

  if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection.status!)) {
    throw invalidArgument(WenError.invalid_collection_status);
  }

  if (nft.saleAccess === NftAccess.MEMBERS && !(nft.saleAccessMembers || []).includes(owner)) {
    throw invalidArgument(WenError.you_are_not_allowed_member_to_purchase_this_nft);
  }

  if (!nft.auctionFrom) {
    throw invalidArgument(WenError.nft_not_available_for_sale);
  }

  if (nft.placeholderNft) {
    throw invalidArgument(WenError.nft_placeholder_cant_be_purchased);
  }

  if (nft.owner === owner) {
    throw invalidArgument(WenError.you_cant_buy_your_nft);
  }

  const isProd = isProdEnv();
  const network = nft.mintingData?.network || (isProd ? Network.IOTA : Network.ATOI);

  const prevOwnerDocRef = build5Db().doc(`${COL.MEMBER}/${nft.owner}`);
  const prevOwner = await prevOwnerDocRef.get<Member | undefined>();
  assertMemberHasValidAddress(prevOwner, network);

  const newWallet = await WalletService.newWallet(network);
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  const royaltySpace = await getSpace(collection.royaltiesSpace);

  const auctionFloorPrice = nft.auctionFloorPrice || MIN_AMOUNT_TO_TRANSFER;
  const finalPrice = Number(Math.max(auctionFloorPrice, MIN_AMOUNT_TO_TRANSFER).toPrecision(2));

  return {
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: collection.space,
    network,
    payload: {
      type: TransactionPayloadType.NFT_BID,
      amount: finalPrice,
      targetAddress: targetAddress.bech32,
      beneficiary: nft.owner ? Entity.MEMBER : Entity.SPACE,
      beneficiaryUid: nft.owner || collection.space,
      beneficiaryAddress: getAddress(nft.owner ? prevOwner : space, network),
      royaltiesFee: collection.royaltiesFee,
      royaltiesSpace: collection.royaltiesSpace,
      royaltiesSpaceAddress: getAddress(royaltySpace, network),
      expiresOn: nft.auctionTo!,
      reconciled: false,
      validationType: TransactionValidationType.ADDRESS,
      void: false,
      chainReference: null,
      nft: nft.uid,
      collection: collection.uid,
      restrictions: getRestrictions(collection, nft),
    },
    linkedTransactions: [],
  };
};
