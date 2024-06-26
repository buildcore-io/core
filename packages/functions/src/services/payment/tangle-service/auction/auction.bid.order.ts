import { database } from '@buildcore/database';
import {
  Auction,
  AuctionType,
  COL,
  CollectionStatus,
  Entity,
  MIN_AMOUNT_TO_TRANSFER,
  Nft,
  NftAccess,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import { assertMemberHasValidAddress, getAddress } from '../../../../utils/address.utils';
import { generateRandomAmount, getRestrictions } from '../../../../utils/common.utils';
import { isProdEnv } from '../../../../utils/config.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertIpNotBlocked } from '../../../../utils/ip.utils';
import { getSpace } from '../../../../utils/space.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet.service';

export const createBidOrder = async (
  project: string,
  owner: string,
  auctionId: string,
  ip = '',
): Promise<Transaction> => {
  const auctionDocRef = database().doc(COL.AUCTION, auctionId);
  const auction = await auctionDocRef.get();
  if (!auction) {
    throw invalidArgument(WenError.auction_does_not_exist);
  }
  if (!auction.active) {
    throw invalidArgument(WenError.auction_not_active);
  }

  const validationResponse = await assertAuctionData(owner, ip, auction);

  const network = auction?.network;

  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const order = {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: '',
    network,
    payload: {
      type:
        auction.type === AuctionType.NFT
          ? TransactionPayloadType.NFT_BID
          : TransactionPayloadType.AUCTION_BID,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp((auction.extendedAuctionTo || auction.auctionTo).toDate()),
      reconciled: false,
      validationType: TransactionValidationType.ADDRESS,
      void: false,
      chainReference: null,
      auction: auction.uid,
    },
    linkedTransactions: [],
  };

  if (auction.type === AuctionType.NFT) {
    const nft = validationResponse as Nft;

    const collectionDocRef = database().doc(COL.COLLECTION, nft.collection);
    const collection = (await collectionDocRef.get())!;

    const spaceDocRef = database().doc(COL.SPACE, collection.space!);
    const space = await spaceDocRef.get();

    const prevOwnerDocRef = database().doc(COL.MEMBER, nft.owner!);
    const prevOwner = await prevOwnerDocRef.get();
    assertMemberHasValidAddress(prevOwner, network);

    const royaltySpace = await getSpace(collection.royaltiesSpace);

    const auctionFloorPrice = auction.auctionFloorPrice || MIN_AMOUNT_TO_TRANSFER;
    const finalPrice = Number(Math.max(auctionFloorPrice, MIN_AMOUNT_TO_TRANSFER).toPrecision(2));

    return {
      ...order,
      space: collection.space,
      payload: {
        ...order.payload,
        amount: finalPrice,
        beneficiary: nft.owner ? Entity.MEMBER : Entity.SPACE,
        beneficiaryUid: nft.owner || collection.space,
        beneficiaryAddress: getAddress(nft.owner ? prevOwner : space, network),
        royaltiesFee: collection.royaltiesFee,
        royaltiesSpace: collection.royaltiesSpace || '',
        royaltiesSpaceAddress: getAddress(royaltySpace, network),
        expiresOn: nft.auctionTo!,
        nft: nft.uid,
        collection: collection.uid,
        restrictions: getRestrictions(collection, nft),
      },
    };
  }

  return order;
};

const assertAuctionData = async (owner: string, ip: string, auction: Auction) => {
  if (!auction.active) {
    throw invalidArgument(WenError.auction_not_active);
  }
  switch (auction.type) {
    case AuctionType.NFT:
      return await assertNftAuction(owner, ip, auction);
  }
  return;
};

const assertNftAuction = async (owner: string, ip: string, auction: Auction) => {
  const nftDocRef = database().doc(COL.NFT, auction.nftId!);
  const nft = await nftDocRef.get();
  if (!nft) {
    throw invalidArgument(WenError.nft_does_not_exists);
  }

  if (isProdEnv()) {
    await assertIpNotBlocked(ip, nft.uid, 'nft');
  }

  const collectionDocRef = database().doc(COL.COLLECTION, nft.collection);
  const collection = (await collectionDocRef.get())!;

  if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection.status!)) {
    throw invalidArgument(WenError.invalid_collection_status);
  }

  if (nft.saleAccess === NftAccess.MEMBERS && !(nft.saleAccessMembers || []).includes(owner)) {
    throw invalidArgument(WenError.you_are_not_allowed_member_to_purchase_this_nft);
  }

  if (nft.placeholderNft) {
    throw invalidArgument(WenError.nft_placeholder_cant_be_purchased);
  }

  if (nft.owner === owner) {
    throw invalidArgument(WenError.you_cant_buy_your_nft);
  }

  return nft;
};
