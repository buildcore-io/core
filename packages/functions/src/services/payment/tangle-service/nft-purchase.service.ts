import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  DEFAULT_NETWORK,
  Entity,
  MIN_AMOUNT_TO_TRANSFER,
  Member,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  Nft,
  NftAccess,
  NftStatus,
  Space,
  StakeType,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import { BaseTangleResponse } from '@build-5/interfaces/lib/api/tangle/common';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { build5Db } from '../../../firebase/firestore/build5Db';
import { nftPurchaseSchema } from '../../../runtime/firebase/nft';
import { assertHasAccess } from '../../../services/validators/access';
import { WalletService } from '../../../services/wallet/wallet';
import { getAddress } from '../../../utils/address.utils';
import { getNftByMintingId } from '../../../utils/collection-minting-utils/nft.utils';
import { getRestrictions } from '../../../utils/common.utils';
import { isProdEnv } from '../../../utils/config.utils';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { invalidArgument } from '../../../utils/error.utils';
import { assertIpNotBlocked } from '../../../utils/ip.utils';
import { assertValidationAsync } from '../../../utils/schema.utils';
import { getSpace } from '../../../utils/space.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { TransactionService } from '../transaction-service';

export class TangleNftPurchaseService {
  constructor(readonly transactionService: TransactionService) {}

  public handleNftPurchase = async (
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
  ): Promise<BaseTangleResponse | undefined> => {
    delete request.requestType;
    const params = await assertValidationAsync(nftPurchaseSchema, request);

    const order = await createNftPuchaseOrder(params.collection, params.nft, owner);
    set(order, 'payload.tanglePuchase', true);

    this.transactionService.push({
      ref: build5Db().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });

    const isMintedNft = AVAILABLE_NETWORKS.includes(order.network!);

    if (isMintedNft && tranEntry.amount !== order.payload.amount) {
      return {
        status: 'error',
        amount: order.payload.amount!,
        address: order.payload.targetAddress!,
        code: WenError.invalid_base_token_amount.code,
        message: WenError.invalid_base_token_amount.key,
      };
    }

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

export const createNftPuchaseOrder = async (
  collectionId: string,
  nftId: string | undefined,
  owner: string,
  ip = '',
): Promise<Transaction> => {
  const collection = await getCollection(collectionId);
  const space = (await getSpace(collection.space))!;

  const isProd = isProdEnv();
  const nft = await getNft(collection, nftId);
  const network = nft.mintingData?.network || (isProd ? Network.IOTA : Network.ATOI);

  if (isProd) {
    await assertIpNotBlocked(ip, nft.uid, 'nft');
  }

  await assertNftCanBePurchased(space, collection, nft, nftId, owner);

  const currentOwner = nft.owner ? await getMember(nft.owner) : space;
  assertCurrentOwnerAddress(currentOwner, nft);

  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const royaltySpace = await getSpace(collection.royaltiesSpace);

  const nftPurchaseOrderId = getRandomEthAddress();
  await lockNft(nft.uid, nftPurchaseOrderId);

  const member = await getMember(owner);
  const discount = getDiscount(collection, member);
  const finalPrice = getNftFinalPrice(nft, discount);

  return {
    type: TransactionType.ORDER,
    uid: nftPurchaseOrderId,
    member: owner,
    space: space.uid,
    network,
    payload: {
      type: TransactionPayloadType.NFT_PURCHASE,
      amount: finalPrice,
      targetAddress: targetAddress.bech32,
      beneficiary: nft.owner ? Entity.MEMBER : Entity.SPACE,
      beneficiaryUid: nft.owner || collection.space,
      beneficiaryAddress: getAddress(currentOwner, network),
      royaltiesFee: collection.royaltiesFee,
      royaltiesSpace: collection.royaltiesSpace,
      royaltiesSpaceAddress: getAddress(royaltySpace, network),
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      nft: nft.uid,
      collection: collection.uid,
      restrictions: getRestrictions(collection, nft),
    },
    linkedTransactions: [],
  };
};

const getCollection = async (id: string) => {
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${id}`);
  const collection = await collectionDocRef.get<Collection>();
  if (!collection) {
    throw invalidArgument(WenError.collection_does_not_exists);
  }

  if (!collection.approved) {
    throw invalidArgument(WenError.collection_must_be_approved);
  }

  if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection.status!)) {
    throw invalidArgument(WenError.invalid_collection_status);
  }
  return collection;
};

const getMember = async (id: string) => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${id}`);
  return <Member>await memberDocRef.get();
};

const getNft = async (collection: Collection, nftId: string | undefined) => {
  if (nftId) {
    const docRef = build5Db().doc(`${COL.NFT}/${nftId}`);
    const nft = (await getNftByMintingId(nftId)) || (await docRef.get<Nft>());
    if (nft) {
      return nft;
    }
    throw invalidArgument(WenError.nft_does_not_exists);
  }

  if (collection.type === CollectionType.CLASSIC) {
    throw invalidArgument(WenError.nft_does_not_exists);
  }

  const randomPosition = Math.floor(Math.random() * collection.total);

  const nftAbove = await getNftAbove(collection, randomPosition);
  if (nftAbove.length) {
    return nftAbove[0];
  }

  const nftBelow = await getNftBelow(collection, randomPosition);
  if (nftBelow.length) {
    return nftBelow[0];
  }

  throw invalidArgument(WenError.no_more_nft_available_for_sale);
};

const getNftAbove = (collection: Collection, position: number) =>
  build5Db()
    .collection(COL.NFT)
    .where('sold', '==', false)
    .where('locked', '==', false)
    .where('placeholderNft', '==', false)
    .where('collection', '==', collection.uid)
    .where('position', '>=', position)
    .orderBy('position', 'asc')
    .limit(1)
    .get<Nft>();

const getNftBelow = (collection: Collection, position: number) =>
  build5Db()
    .collection(COL.NFT)
    .where('sold', '==', false)
    .where('locked', '==', false)
    .where('placeholderNft', '==', false)
    .where('collection', '==', collection.uid)
    .where('position', '<=', position)
    .orderBy('position', 'desc')
    .limit(1)
    .get<Nft>();

const assertNftCanBePurchased = async (
  space: Space,
  collection: Collection,
  nft: Nft,
  nftIdParam: string | undefined,
  owner: string,
) => {
  if (collection.type !== CollectionType.CLASSIC && nftIdParam && !nft.owner) {
    throw invalidArgument(WenError.generated_spf_nft_must_be_sold_first);
  }

  if (!nft.availableFrom || dayjs(nft.availableFrom.toDate()).isAfter(dayjs())) {
    throw invalidArgument(WenError.nft_not_available_for_sale);
  }

  if (nft.owner === owner) {
    throw invalidArgument(WenError.you_cant_buy_your_nft);
  }

  if (nft.locked) {
    throw invalidArgument(WenError.nft_locked_for_sale);
  }

  if (nft.placeholderNft) {
    throw invalidArgument(WenError.nft_placeholder_cant_be_purchased);
  }

  if (
    nft.owner &&
    nft.saleAccess === NftAccess.MEMBERS &&
    !(nft.saleAccessMembers || []).includes(owner)
  ) {
    throw invalidArgument(WenError.you_are_not_allowed_member_to_purchase_this_nft);
  }

  if (!nft.owner) {
    await assertUserHasAccess(space, collection, owner);
  }

  if (!nft.owner && collection.onePerMemberOnly === true) {
    await assertUserHasOnlyOneNft(collection, owner);
  }

  if (nft.collection !== collection.uid) {
    throw invalidArgument(WenError.nft_does_not_belong_to_collection);
  }

  await assertNoOrderInProgress(owner);
};

const assertUserHasAccess = (space: Space, collection: Collection, owner: string) =>
  assertHasAccess(
    space.uid,
    owner,
    collection.access,
    collection.accessAwards || [],
    collection.accessCollections || [],
  );

const assertUserHasOnlyOneNft = async (collection: Collection, owner: string) => {
  const snap = await build5Db()
    .collection(COL.TRANSACTION)
    .where('member', '==', owner)
    .where('type', '==', TransactionType.BILL_PAYMENT)
    .where('payload.collection', '==', collection.uid)
    .where('payload.previousOwnerEntity', '==', 'space')
    .get();
  if (snap.length) {
    throw invalidArgument(WenError.you_can_only_own_one_nft_from_collection);
  }
};

const assertNoOrderInProgress = async (owner: string) => {
  const orderInProgress = await build5Db()
    .collection(COL.TRANSACTION)
    .where('payload.reconciled', '==', false)
    .where('payload.type', '==', TransactionPayloadType.NFT_PURCHASE)
    .where('member', '==', owner)
    .where('type', '==', TransactionType.ORDER)
    .where('payload.void', '==', false)
    .get();

  if (orderInProgress.length) {
    throw invalidArgument(WenError.you_have_currently_another_order_in_progress);
  }
};

const assertCurrentOwnerAddress = (currentOwner: Space | Member, nft: Nft) => {
  const network = nft.mintingData?.network || DEFAULT_NETWORK;
  const currentOwnerAddress = getAddress(currentOwner, network);
  if (isEmpty(currentOwnerAddress)) {
    if (nft.owner) {
      throw invalidArgument(WenError.member_must_have_validated_address);
    }
    throw invalidArgument(WenError.space_must_have_validated_address);
  }
};

const getDiscount = (collection: Collection, member: Member) => {
  const spaceRewards = (member.spaces || {})[collection.space] || {};
  const descDiscounts = [...(collection.discounts || [])].sort((a, b) => b.amount - a.amount);
  for (const discount of descDiscounts) {
    const awardStat = (spaceRewards.awardStat || {})[discount.tokenUid!];
    const memberTotalReward = awardStat?.totalReward || 0;
    if (memberTotalReward >= discount.tokenReward) {
      return 1 - discount.amount;
    }
  }
  return 1;
};

const lockNft = async (nftId: string, orderId: string) =>
  build5Db().runTransaction(async (transaction) => {
    const docRef = build5Db().doc(`${COL.NFT}/${nftId}`);
    const nft = <Nft>await transaction.get(docRef);
    if (nft.locked) {
      throw invalidArgument(WenError.nft_locked_for_sale);
    }
    transaction.update(docRef, { locked: true, lockedBy: orderId });
  });

const getNftFinalPrice = (nft: Nft, discount: number) => {
  let finalPrice = nft.availablePrice || nft.price;
  if (discount < 1 && !nft.owner) {
    finalPrice = Math.ceil(discount * nft.price);
  }
  finalPrice = Math.max(finalPrice, MIN_AMOUNT_TO_TRANSFER);
  return Math.floor(finalPrice / 1000 / 10) * 1000 * 10;
};

export const createNftWithdrawOrder = (
  nft: Nft,
  member: string,
  targetAddress: string,
  weeks = 0,
  stakeType?: StakeType,
) => {
  const order = <Transaction>{
    type: TransactionType.WITHDRAW_NFT,
    uid: getRandomEthAddress(),
    member,
    space: nft.space,
    network: nft.mintingData?.network,
    payload: {
      amount: nft.depositData?.storageDeposit || nft.mintingData?.storageDeposit || 0,
      sourceAddress: nft.depositData?.address || nft.mintingData?.address,
      targetAddress,
      collection: nft.collection,
      nft: nft.uid,
      vestingAt: dateToTimestamp(dayjs().add(weeks, 'weeks')),
      stakeType: stakeType || null,
      weeks,
      nftId: nft.mintingData?.nftId || '',
    },
  };
  const nftUpdateData = {
    uid: nft.uid,
    status: stakeType ? NftStatus.STAKED : NftStatus.WITHDRAWN,
    hidden: true,
    depositData: build5Db().deleteField(),
    owner: null,
    isOwned: false,
  };
  return { order, nftUpdateData };
};
