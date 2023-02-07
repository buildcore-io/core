import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  DEFAULT_NETWORK,
  Member,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  MIN_AMOUNT_TO_TRANSFER,
  Nft,
  NftAccess,
  NftStatus,
  Space,
  StakeType,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { isEmpty, set } from 'lodash';
import admin from '../../../admin.config';
import { assertHasAccess } from '../../../services/validators/access';
import { WalletService } from '../../../services/wallet/wallet';
import { getAddress } from '../../../utils/address.utils';
import { getNftByMintingId } from '../../../utils/collection-minting-utils/nft.utils';
import { isProdEnv } from '../../../utils/config.utils';
import { dateToTimestamp, uOn } from '../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../utils/error.utils';
import { assertIpNotBlocked } from '../../../utils/ip.utils';
import { assertValidationAsync } from '../../../utils/schema.utils';
import {
  getRandomEthAddress,
  maxAddressLength,
  minAddressLength,
} from '../../../utils/wallet.utils';
import { TransactionService } from '../transaction-service';

const nftPurchaseSchema = {
  nft: Joi.string().alphanum().min(minAddressLength).max(maxAddressLength).lowercase().required(),
};

export class TangleNftPurchaseService {
  constructor(readonly transactionService: TransactionService) {}

  public handleNftPurchase = async (
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
  ) => {
    const params = { nft: request.nft };
    const schema = Joi.object(nftPurchaseSchema);
    await assertValidationAsync(schema, params);

    const nftByMintingId = await getNftByMintingId(params.nft as string);
    if (!nftByMintingId) {
      throw throwInvalidArgument(WenError.nft_does_not_exists);
    }

    const order = await createNftPuchaseOrder(
      nftByMintingId.collection,
      nftByMintingId.uid,
      owner,
      '',
    );
    set(order, 'payload.tanglePuchase', true);

    if (tranEntry.amount !== order.payload.amount) {
      return {
        requiredAmount: order.payload.amount,
        status: 'error',
        code: WenError.invalid_base_token_amount.code,
        message: WenError.invalid_base_token_amount.key,
      };
    }

    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });

    this.transactionService.createUnlockTransaction(
      order,
      tran,
      tranEntry,
      TransactionUnlockType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );
    return;
  };
}

export const createNftPuchaseOrder = async (
  collectionId: string,
  nftId: string,
  owner: string,
  ip = '',
) => {
  const collection = await getCollection(collectionId);
  const space = await getSpace(collection.space);

  const nft = await getNft(collection, nftId);
  const network = nft.mintingData?.network || DEFAULT_NETWORK;

  if (isProdEnv()) {
    await assertIpNotBlocked(ip, nft.uid, 'nft');
  }

  await assertNftCanBePurchased(space, collection, nft, nftId, owner);

  const currentOwner = nft.owner ? await getMember(nft.owner) : space;
  assertCurrentOwnerAddress(currentOwner, nft);

  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const royaltySpaceDocRef = admin.firestore().collection(COL.SPACE).doc(collection.royaltiesSpace);
  const royaltySpace = <Space | undefined>(await royaltySpaceDocRef.get()).data();

  const nftPurchaseOrderId = getRandomEthAddress();
  await lockNft(nft.uid, nftPurchaseOrderId);

  const member = await getMember(owner);
  const discount = getDiscount(collection, member);
  const finalPrice = getNftFinalPrice(nft, discount);

  return <Transaction>{
    type: TransactionType.ORDER,
    uid: nftPurchaseOrderId,
    member: owner,
    space: space.uid,
    network,
    payload: {
      type: TransactionOrderType.NFT_PURCHASE,
      amount: finalPrice,
      targetAddress: targetAddress.bech32,
      beneficiary: nft.owner ? 'member' : 'space',
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
    },
    linkedTransactions: [],
  };
};

const getCollection = async (id: string) => {
  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${id}`);
  const collection = <Collection | undefined>(await collectionDocRef.get()).data();
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  if (!collection.approved) {
    throw throwInvalidArgument(WenError.collection_must_be_approved);
  }

  if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection.status!)) {
    throw throwInvalidArgument(WenError.invalid_collection_status);
  }
  return collection;
};

const getMember = async (id: string) => {
  const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${id}`);
  return <Member>(await memberDocRef.get()).data();
};

const getSpace = async (id: string) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${id}`);
  return <Space>(await spaceDocRef.get()).data();
};

const getNft = async (collection: Collection, nftId: string | undefined) => {
  if (nftId) {
    const docRef = admin.firestore().doc(`${COL.NFT}/${nftId}`);
    const nft = <Nft | undefined>(await docRef.get()).data();
    if (!nft) {
      throw throwInvalidArgument(WenError.nft_does_not_exists);
    }
    return nft;
  }

  if (collection.type === CollectionType.CLASSIC) {
    throw throwInvalidArgument(WenError.nft_does_not_exists);
  }

  const randomPosition = Math.floor(Math.random() * collection.total);

  const nftAbove = await getNftAbove(collection, randomPosition);
  if (nftAbove.size) {
    return <Nft>nftAbove.docs[0].data();
  }

  const nftBelow = await getNftBelow(collection, randomPosition);
  if (nftBelow.size) {
    return <Nft>nftBelow.docs[0].data();
  }

  throw throwInvalidArgument(WenError.no_more_nft_available_for_sale);
};

const getNftAbove = (collection: Collection, position: number) =>
  admin
    .firestore()
    .collection(COL.NFT)
    .where('sold', '==', false)
    .where('locked', '==', false)
    .where('placeholderNft', '==', false)
    .where('collection', '==', collection.uid)
    .where('position', '>=', position)
    .orderBy('position', 'asc')
    .limit(1)
    .get();

const getNftBelow = (collection: Collection, position: number) =>
  admin
    .firestore()
    .collection(COL.NFT)
    .where('sold', '==', false)
    .where('locked', '==', false)
    .where('placeholderNft', '==', false)
    .where('collection', '==', collection.uid)
    .where('position', '<=', position)
    .orderBy('position', 'desc')
    .limit(1)
    .get();

const assertNftCanBePurchased = async (
  space: Space,
  collection: Collection,
  nft: Nft,
  nftIdParam: string,
  owner: string,
) => {
  if (collection.type !== CollectionType.CLASSIC && nftIdParam && !nft.owner) {
    throw throwInvalidArgument(WenError.generated_spf_nft_must_be_sold_first);
  }

  if (!nft.availableFrom || dayjs(nft.availableFrom.toDate()).isAfter(dayjs())) {
    throw throwInvalidArgument(WenError.nft_not_available_for_sale);
  }

  if (nft.owner === owner) {
    throw throwInvalidArgument(WenError.you_cant_buy_your_nft);
  }

  if (nft.locked) {
    throw throwInvalidArgument(WenError.nft_locked_for_sale);
  }

  if (nft.placeholderNft) {
    throw throwInvalidArgument(WenError.nft_placeholder_cant_be_purchased);
  }

  if (
    nft.owner &&
    nft.saleAccess === NftAccess.MEMBERS &&
    !(nft.saleAccessMembers || []).includes(owner)
  ) {
    throw throwInvalidArgument(WenError.you_are_not_allowed_member_to_purchase_this_nft);
  }

  if (!nft.owner) {
    await assertUserHasAccess(space, collection, owner);
  }

  if (!nft.owner && collection.onePerMemberOnly === true) {
    await assertUserHasOnlyOneNft(collection, owner);
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
  const snap = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('member', '==', owner)
    .where('type', '==', TransactionType.BILL_PAYMENT)
    .where('payload.collection', '==', collection.uid)
    .where('payload.previousOwnerEntity', '==', 'space')
    .get();
  if (snap.size) {
    throw throwInvalidArgument(WenError.you_can_only_own_one_nft_from_collection);
  }
};

const assertNoOrderInProgress = async (owner: string) => {
  const orderInProgress = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.reconciled', '==', false)
    .where('payload.type', '==', TransactionOrderType.NFT_PURCHASE)
    .where('member', '==', owner)
    .where('type', '==', TransactionType.ORDER)
    .where('payload.void', '==', false)
    .get();

  if (orderInProgress.size) {
    throw throwInvalidArgument(WenError.you_have_currently_another_order_in_progress);
  }
};

const assertCurrentOwnerAddress = (currentOwner: Space | Member, nft: Nft) => {
  const network = nft.mintingData?.network || DEFAULT_NETWORK;
  const currentOwnerAddress = getAddress(currentOwner, network);
  if (isEmpty(currentOwnerAddress)) {
    if (nft.owner) {
      throw throwInvalidArgument(WenError.member_must_have_validated_address);
    }
    throw throwInvalidArgument(WenError.space_must_have_validated_address);
  }
};

const getDiscount = (collection: Collection, member: Member) => {
  if (!isEmpty(collection.discounts)) {
    const memberXp = member.spaces?.[collection.space]?.totalReputation || 0;
    const sortedDiscounts = collection.discounts.sort((a, b) => a.xp - b.xp);
    for (const d of sortedDiscounts) {
      if (Number(d.xp) < memberXp) {
        return 1 - d.amount;
      }
    }
  }
  return 1;
};

const lockNft = async (nftId: string, orderId: string) =>
  admin.firestore().runTransaction(async (transaction) => {
    const docRef = admin.firestore().doc(`${COL.NFT}/${nftId}`);
    const nft = <Nft>(await transaction.get(docRef)).data();
    if (nft.locked) {
      throw throwInvalidArgument(WenError.nft_locked_for_sale);
    }
    transaction.update(docRef, uOn({ locked: true, lockedBy: orderId }));
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
    },
  };
  const nftUpdateData = {
    uid: nft.uid,
    status: stakeType ? NftStatus.STAKED : NftStatus.WITHDRAWN,
    hidden: true,
    depositData: admin.firestore.FieldValue.delete(),
  };
  return { order, nftUpdateData };
};
