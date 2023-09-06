import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  CollectionStatus,
  DEFAULT_NETWORK,
  Entity,
  Member,
  MIN_AMOUNT_TO_TRANSFER,
  Nft,
  NftAccess,
  NftBidRequest,
  Space,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress, getAddress } from '../../utils/address.utils';
import { getRestrictions } from '../../utils/common.utils';
import { isProdEnv } from '../../utils/config.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIpNotBlocked } from '../../utils/ip.utils';
import { getSpace } from '../../utils/space.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const nftBidControl = async (
  owner: string,
  params: NftBidRequest,
  customParams?: Record<string, unknown>,
): Promise<Transaction> => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const nftDocRef = build5Db().doc(`${COL.NFT}/${params.nft}`);
  const nft = await nftDocRef.get<Nft>();
  if (!nft) {
    throw invalidArgument(WenError.nft_does_not_exists);
  }

  if (isProdEnv()) {
    await assertIpNotBlocked((customParams?.ip as string) || '', nft.uid, 'nft');
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
  const network = nft.mintingData?.network || DEFAULT_NETWORK;

  const prevOwnerDocRef = build5Db().doc(`${COL.MEMBER}/${nft.owner}`);
  const prevOwner = await prevOwnerDocRef.get<Member | undefined>();
  assertMemberHasValidAddress(prevOwner, network);

  const newWallet = await WalletService.newWallet(network);
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  const royaltySpace = await getSpace(collection.royaltiesSpace);

  const auctionFloorPrice = nft.auctionFloorPrice || MIN_AMOUNT_TO_TRANSFER;
  const finalPrice = Number(Math.max(auctionFloorPrice, MIN_AMOUNT_TO_TRANSFER).toPrecision(2));

  const bidTransaction: Transaction = {
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
  const transactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${bidTransaction.uid}`);
  await transactionDocRef.create(bidTransaction);

  return (await transactionDocRef.get())!;
};
