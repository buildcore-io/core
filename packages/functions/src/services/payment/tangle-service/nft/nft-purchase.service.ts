import { PgNftUpdate, database } from '@buildcore/database';
import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  DEFAULT_NETWORK,
  Entity,
  MIN_AMOUNT_TO_TRANSFER,
  Member,
  Network,
  NetworkAddress,
  Nft,
  NftAccess,
  NftStatus,
  Space,
  StakeType,
  TRANSACTION_AUTO_EXPIRY_MS,
  TangleResponse,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { getAddress } from '../../../../utils/address.utils';
import { getNftByMintingId } from '../../../../utils/collection-minting-utils/nft.utils';
import { getProject, getRestrictions } from '../../../../utils/common.utils';
import { isProdEnv } from '../../../../utils/config.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertIpNotBlocked } from '../../../../utils/ip.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getSpace } from '../../../../utils/space.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { assertHasAccess } from '../../../validators/access';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { nftPurchaseSchema } from './NftPurchaseTangleRequestSchema';

export class TangleNftPurchaseService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    order: tangleOrder,
    request,
    owner,
    tran,
    tranEntry,
    payment,
  }: HandlerParams) => {
    const params = await assertValidationAsync(nftPurchaseSchema, request);

    const order = await createNftPuchaseOrder(
      getProject(tangleOrder),
      params.collection,
      params.nft,
      owner,
      '',
      true,
    );
    order.payload.tanglePuchase = true;
    order.payload.disableWithdraw = params.disableWithdraw || false;

    this.transactionService.push({
      ref: database().doc(COL.TRANSACTION, order.uid),
      data: order,
      action: Action.C,
    });

    if (tranEntry.amount !== order.payload.amount || tangleOrder.network !== order.network) {
      return {
        status: 'error',
        amount: order.payload.amount!,
        address: order.payload.targetAddress!,
        code: WenError.invalid_base_token_amount.code,
        message: WenError.invalid_base_token_amount.key,
      };
    }

    this.transactionService.createUnlockTransaction(
      payment,
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );

    return {};
  };
}

export const createNftPuchaseOrder = async (
  project: string,
  collectionId: string,
  nftId: string | undefined,
  owner: string,
  ip = '',
  allowParallelPurchasing = false,
): Promise<Transaction> => {
  const collection = await getCollection(collectionId);
  const space = (await getSpace(collection.space))!;

  const isProd = isProdEnv();
  const nft = await getNft(collection, nftId);
  const network = nft.mintingData?.network || (isProd ? Network.IOTA : Network.ATOI);

  if (isProd) {
    await assertIpNotBlocked(ip, nft.uid, 'nft');
  }

  await assertNftCanBePurchased(space, collection, nft, nftId, owner, allowParallelPurchasing);

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
    project,
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
      royaltiesSpace: collection.royaltiesSpace || '',
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

export const getCollection = async (id: string) => {
  const collectionDocRef = database().doc(COL.COLLECTION, id);
  const collection = await collectionDocRef.get();
  if (!collection) {
    throw invalidArgument(WenError.collection_does_not_exists);
  }

  if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection.status!)) {
    throw invalidArgument(WenError.invalid_collection_status);
  }
  return collection;
};

export const getMember = async (id: string) => {
  const memberDocRef = database().doc(COL.MEMBER, id);
  return <Member>await memberDocRef.get();
};

const getNft = async (collection: Collection, nftId: string | undefined) => {
  if (nftId) {
    const docRef = database().doc(COL.NFT, nftId);
    const nft = (await getNftByMintingId(nftId)) || (await docRef.get());
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

export const getNftAbove = (collection: Collection, position: number, limit = 1) =>
  database()
    .collection(COL.NFT)
    .where('sold', '==', false)
    .where('locked', '==', false)
    .where('placeholderNft', '==', false)
    .where('collection', '==', collection.uid)
    .where('position', '>=', position)
    .orderBy('position', 'asc')
    .limit(limit)
    .get();

export const getNftBelow = (collection: Collection, position: number, limit = 1) =>
  database()
    .collection(COL.NFT)
    .where('sold', '==', false)
    .where('locked', '==', false)
    .where('placeholderNft', '==', false)
    .where('collection', '==', collection.uid)
    .where('position', '<=', position)
    .orderBy('position', 'desc')
    .limit(limit)
    .get();

export const assertNftCanBePurchased = async (
  space: Space,
  collection: Collection,
  nft: Nft,
  nftIdParam: string | undefined,
  owner: string,
  allowParallelPurchasing: boolean,
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

  if (!allowParallelPurchasing) {
    await assertNoOrderInProgress(owner);
  }
};

export const assertUserHasAccess = (space: Space, collection: Collection, owner: string) =>
  assertHasAccess(
    space.uid,
    owner,
    collection.access,
    collection.accessAwards || [],
    collection.accessCollections || [],
  );

export const assertUserHasOnlyOneNft = async (collection: Collection, owner: string) => {
  const snap = await database()
    .collection(COL.TRANSACTION)
    .where('member', '==', owner)
    .where('type', '==', TransactionType.BILL_PAYMENT)
    .where('payload_collection', '==', collection.uid)
    .where('payload_previousOwnerEntity', '==', Entity.SPACE)
    .get();
  if (snap.length) {
    throw invalidArgument(WenError.you_can_only_own_one_nft_from_collection);
  }
};

export const assertNoOrderInProgress = async (owner: string) => {
  const orderInProgress = await database()
    .collection(COL.TRANSACTION)
    .where('payload_reconciled', '==', false)
    .where('payload_type', '==', TransactionPayloadType.NFT_PURCHASE)
    .where('member', '==', owner)
    .where('type', '==', TransactionType.ORDER)
    .where('payload_void', '==', false)
    .get();

  if (orderInProgress.length) {
    throw invalidArgument(WenError.you_have_currently_another_order_in_progress);
  }
};

export const assertCurrentOwnerAddress = (currentOwner: Space | Member, nft: Nft) => {
  const network = nft.mintingData?.network || DEFAULT_NETWORK;
  const currentOwnerAddress = getAddress(currentOwner, network);
  if (isEmpty(currentOwnerAddress)) {
    if (nft.owner) {
      throw invalidArgument(WenError.member_must_have_validated_address);
    }
    throw invalidArgument(WenError.space_must_have_validated_address);
  }
};

export const getDiscount = (collection: Collection, member: Member) => {
  const spaceRewards = (member.spaces || {})[collection.space || ''] || {};
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

export const lockNft = (nftId: string, orderId: string) =>
  database().runTransaction(async (transaction) => {
    const docRef = database().doc(COL.NFT, nftId);
    const nft = <Nft>await transaction.get(docRef);
    if (nft.locked) {
      throw invalidArgument(WenError.nft_locked_for_sale);
    }
    await transaction.update(docRef, { locked: true, lockedBy: orderId });
  });

export const getNftFinalPrice = (nft: Nft, discount: number) => {
  let finalPrice = nft.availablePrice || nft.price;
  if (discount < 1 && !nft.owner) {
    finalPrice = Math.ceil(discount * nft.price);
  }
  finalPrice = Math.max(finalPrice, MIN_AMOUNT_TO_TRANSFER);
  return Math.floor(finalPrice / 1000 / 10) * 1000 * 10;
};

export const createNftWithdrawOrder = (
  project: string,
  nft: Nft,
  member: string,
  targetAddress: NetworkAddress,
  weeks = 0,
  stakeType?: StakeType,
) => {
  const order: Transaction = {
    project,
    type: TransactionType.WITHDRAW_NFT,
    uid: getRandomEthAddress(),
    member,
    space: nft.space,
    network: nft.mintingData?.network!,
    payload: {
      amount: nft.depositData?.storageDeposit || nft.mintingData?.storageDeposit || 0,
      sourceAddress: nft.depositData?.address || nft.mintingData?.address,
      targetAddress,
      collection: nft.collection,
      nft: nft.uid,
      vestingAt: dateToTimestamp(dayjs().add(weeks, 'weeks')),
      stakeType: (stakeType || null) as StakeType,
      weeks,
      nftId: nft.mintingData?.nftId || '',
    },
  };
  const nftUpdateData: PgNftUpdate = {
    status: stakeType ? NftStatus.STAKED : NftStatus.WITHDRAWN,
    hidden: true,
    depositData_address: undefined,
    depositData_network: undefined,
    depositData_mintedOn: undefined,
    depositData_mintedBy: undefined,
    depositData_blockId: undefined,
    depositData_nftId: undefined,
    depositData_storageDeposit: undefined,
    depositData_aliasBlockId: undefined,
    depositData_aliasId: undefined,
    depositData_aliasStorageDeposit: undefined,
    depositData_mintingOrderId: undefined,
    depositData_nftsToMint: undefined,
    depositData_nftMediaToUpload: undefined,
    depositData_nftMediaToPrepare: undefined,
    depositData_unsoldMintingOptions: undefined,
    depositData_newPrice: undefined,
    depositData_nftsStorageDeposit: undefined,
    owner: undefined,
    isOwned: false,
  };
  return { order, nftUpdateData };
};
