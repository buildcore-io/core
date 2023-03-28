import {
  COL,
  Collection,
  CollectionStatus,
  DEFAULT_NETWORK,
  Member,
  MIN_AMOUNT_TO_TRANSFER,
  Nft,
  NftAccess,
  Space,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress, getAddress } from '../../utils/address.utils';
import { isProdEnv } from '../../utils/config.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIpNotBlocked } from '../../utils/ip.utils';
import { getSpace } from '../../utils/space.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const nftBidControl = async (
  owner: string,
  params: Record<string, unknown>,
  customParams?: Record<string, unknown>,
) => {
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get();
  if (!member) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const nftDocRef = soonDb().doc(`${COL.NFT}/${params.nft}`);
  const nft = await nftDocRef.get<Nft>();
  if (!nft) {
    throw throwInvalidArgument(WenError.nft_does_not_exists);
  }

  if (isProdEnv()) {
    await assertIpNotBlocked((customParams?.ip as string) || '', nft.uid, 'nft');
  }

  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${nft.collection}`);
  const collection = (await collectionDocRef.get<Collection>())!;

  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${collection.space}`);
  const space = await spaceDocRef.get<Space>();

  if (!collection.approved) {
    throw throwInvalidArgument(WenError.collection_must_be_approved);
  }

  if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection.status!)) {
    throw throwInvalidArgument(WenError.invalid_collection_status);
  }

  if (nft.saleAccess === NftAccess.MEMBERS && !(nft.saleAccessMembers || []).includes(owner)) {
    throw throwInvalidArgument(WenError.you_are_not_allowed_member_to_purchase_this_nft);
  }

  if (!nft.auctionFrom) {
    throw throwInvalidArgument(WenError.nft_not_available_for_sale);
  }

  if (nft.placeholderNft) {
    throw throwInvalidArgument(WenError.nft_placeholder_cant_be_purchased);
  }

  if (nft.owner === owner) {
    throw throwInvalidArgument(WenError.you_cant_buy_your_nft);
  }
  const network = nft.mintingData?.network || DEFAULT_NETWORK;

  const prevOwnerDocRef = soonDb().doc(`${COL.MEMBER}/${nft.owner}`);
  const prevOwner = await prevOwnerDocRef.get<Member | undefined>();
  assertMemberHasValidAddress(prevOwner, network);

  const newWallet = await WalletService.newWallet(network);
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  const royaltySpace = await getSpace(collection.royaltiesSpace);

  const auctionFloorPrice = nft.auctionFloorPrice || MIN_AMOUNT_TO_TRANSFER;
  const finalPrice = Number(Math.max(auctionFloorPrice, MIN_AMOUNT_TO_TRANSFER).toPrecision(2));

  const bidTransaction = {
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: collection.space,
    network,
    payload: {
      type: TransactionOrderType.NFT_BID,
      amount: finalPrice,
      targetAddress: targetAddress.bech32,
      beneficiary: nft.owner ? 'member' : 'space',
      beneficiaryUid: nft.owner || collection.space,
      beneficiaryAddress: getAddress(nft.owner ? prevOwner : space, network),
      royaltiesFee: collection.royaltiesFee,
      royaltiesSpace: collection.royaltiesSpace,
      royaltiesSpaceAddress: getAddress(royaltySpace, network),
      expiresOn: nft.auctionTo,
      reconciled: false,
      validationType: TransactionValidationType.ADDRESS,
      void: false,
      chainReference: null,
      nft: nft.uid,
      collection: collection.uid,
    },
    linkedTransactions: [],
  };
  const transactionDocRef = soonDb().doc(`${COL.TRANSACTION}/${bidTransaction.uid}`);
  await transactionDocRef.create(bidTransaction);

  return await transactionDocRef.get<Transaction>();
};
