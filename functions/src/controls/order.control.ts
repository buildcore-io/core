import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from "joi";
import { merge } from 'lodash';
import { DEFAULT_NETWORK, MIN_AMOUNT_TO_TRANSFER } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, WEN_FUNC } from '../../interfaces/functions/index';
import { Member, Space, Transaction } from '../../interfaces/models';
import { COL, ValidatedAddress, WenRequest } from '../../interfaces/models/base';
import { DocumentSnapshotType } from '../../interfaces/models/firebase';
import admin from '../admin.config';
import { scale } from "../scale.settings";
import { CommonJoi } from '../services/joi/common';
import { assertHasAccess } from '../services/validators/access';
import { WalletService } from '../services/wallet/wallet';
import { assertMemberHasValidAddress, assertSpaceHasValidAddress, getAddress } from '../utils/address.utils';
import { generateRandomAmount } from '../utils/common.utils';
import { isProdEnv } from '../utils/config.utils';
import { dateToTimestamp, serverTime } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { assertIpNotBlocked } from '../utils/ip.utils';
import { assertValidation, getDefaultParams } from "../utils/schema.utils";
import { decodeAuth, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { Collection, CollectionType } from './../../interfaces/models/collection';
import { Nft, NftAccess } from './../../interfaces/models/nft';
import { Network, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from './../../interfaces/models/transaction';
import { SpaceValidator } from './../services/validators/space';
import { MnemonicService } from './../services/wallet/mnemonic';

const orderNftSchema = Joi.object(merge(getDefaultParams(), {
  collection: CommonJoi.uidCheck(),
  nft: Joi.string().length(ethAddressLength).lowercase().optional()
}));

export const orderNft: functions.CloudFunction<Transaction> = functions.runWith({
  minInstances: scale(WEN_FUNC.orderNft),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext): Promise<Transaction> => {
  appCheck(WEN_FUNC.orderNft, context);
  // Validate auth details before we continue
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  assertValidation(orderNftSchema.validate(params.body));

  const docMember: DocumentSnapshotType = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const refCollection = admin.firestore().collection(COL.COLLECTION).doc(params.body.collection);
  const docCollection = await refCollection.get();
  const docCollectionData = <Collection>docCollection.data();
  const refSpace = admin.firestore().collection(COL.SPACE).doc(docCollectionData.space);
  const docSpace = await refSpace.get();

  // Collection must be approved.
  if (!docCollectionData.approved) {
    throw throwInvalidArgument(WenError.collection_must_be_approved);
  }

  // Let's determine if NFT can be indicated or we need to randomly select one.
  let refNft: admin.firestore.DocumentReference;
  let mustBeSold = false;
  if (docCollectionData.type === CollectionType.CLASSIC) {
    if (!params.body.nft) {
      throw throwInvalidArgument(WenError.nft_does_not_exists);
    }

    refNft = admin.firestore().collection(COL.NFT).doc(params.body.nft);
  } else {
    if (!params.body.nft) {
      // We need to go find the NFT for purchase.
      const randNumber: number = Math.floor(Math.random() * docCollectionData.total);
      // Above / below
      const nftAbove = await admin.firestore().collection(COL.NFT)
        .where('sold', '==', false)
        .where('locked', '==', false)
        .where('placeholderNft', '==', false)
        .where('collection', '==', docCollectionData.uid)
        .where('position', '>=', randNumber)
        .orderBy('position', 'asc')
        .limit(1)
        .get();
      const nftBelow = await admin.firestore().collection(COL.NFT)
        .where('sold', '==', false)
        .where('locked', '==', false)
        .where('placeholderNft', '==', false)
        .where('collection', '==', docCollectionData.uid)
        .where('position', '<=', randNumber)
        .orderBy('position', 'desc')
        .limit(1)
        .get();
      if (nftAbove.size > 0) {
        refNft = admin.firestore().collection(COL.NFT).doc(nftAbove.docs[0].data().uid);
      } else if (nftBelow.size > 0) {
        refNft = admin.firestore().collection(COL.NFT).doc(nftBelow.docs[0].data().uid);
      } else {
        throw throwInvalidArgument(WenError.no_more_nft_available_for_sale);
      }
    } else {
      refNft = admin.firestore().collection(COL.NFT).doc(params.body.nft);
      mustBeSold = true;
    }
  }

  const docNft: DocumentSnapshotType = await refNft.get();
  if (!docNft.exists) {
    throw throwInvalidArgument(WenError.nft_does_not_exists);
  }
  // Set data object.
  const docNftData: Nft = docNft.data();

  if (isProdEnv()) {
    await assertIpNotBlocked(context.rawRequest?.ip || '', docNft.id, 'nft')
  }

  if (!docNftData.owner) {
    await assertHasAccess(docSpace.id, owner, docCollectionData.access, docCollectionData.accessAwards || [], docCollectionData.accessCollections || []);
  }

  if (!docNftData.owner && docCollectionData.onePerMemberOnly === true) {
    const qry: admin.firestore.QuerySnapshot = await admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', owner)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.royalty', '==', false)
      .where('payload.collection', '==', docCollectionData.uid)
      .where('payload.previousOwnerEntity', '==', 'space').get();
    if (qry.size >= 1) {
      throw throwInvalidArgument(WenError.you_can_only_own_one_nft_from_collection);
    }
  }

  if (mustBeSold && !docNftData.owner) {
    throw throwInvalidArgument(WenError.generated_spf_nft_must_be_sold_first);
  }

  if (!docNft.data().availableFrom || dayjs(docNft.data().availableFrom.toDate()).isAfter(dayjs())) {
    throw throwInvalidArgument(WenError.nft_not_available_for_sale);
  }

  if (docNft.data().locked) {
    throw throwInvalidArgument(WenError.nft_locked_for_sale);
  }

  if (docNft.data().placeholderNft) {
    throw throwInvalidArgument(WenError.nft_placeholder_cant_be_purchased);
  }

  if (docNftData.owner && docNftData.saleAccess === NftAccess.MEMBERS && !(docNftData.saleAccessMembers || []).includes(owner)) {
    throw throwInvalidArgument(WenError.you_are_not_allowed_member_to_purchase_this_nft);
  }

  // Extra check to make sure owner address is defined.
  let prevOwnerAddress: ValidatedAddress | undefined = undefined;
  if (docNft.data().owner) { // &&
    const refPrevOwner: admin.firestore.DocumentReference = admin.firestore().collection(COL.MEMBER).doc(docNft.data().owner);
    const docPrevOwner: DocumentSnapshotType = await refPrevOwner.get();
    assertMemberHasValidAddress(docPrevOwner.data()?.validatedAddress, Network.IOTA)
    prevOwnerAddress = docPrevOwner.data()?.validatedAddress;
  } else {
    assertSpaceHasValidAddress(docSpace.data()?.validatedAddress, Network.IOTA)
  }

  if (docNft.data().owner === owner) {
    throw throwInvalidArgument(WenError.you_cant_buy_your_nft);
  }

  // Validate there isn't any order in progress.
  const orderInProgress: admin.firestore.QuerySnapshot = await admin.firestore().collection(COL.TRANSACTION).where('payload.reconciled', '==', false)
    .where('payload.type', '==', TransactionOrderType.NFT_PURCHASE).where('member', '==', owner)
    .where('type', '==', TransactionType.ORDER).where('payload.void', '==', false).get();

  if (orderInProgress.size > 0) {
    throw throwInvalidArgument(WenError.you_have_currently_another_order_in_progress);
  }

  // Get new target address.
  const newWallet = WalletService.newWallet();
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  const refRoyaltySpace = admin.firestore().collection(COL.SPACE).doc(docCollectionData.royaltiesSpace);
  const docRoyaltySpace = await refRoyaltySpace.get();

  // Document does not exists.
  const tranId: string = getRandomEthAddress();
  const refTran: admin.firestore.DocumentReference = admin.firestore().collection(COL.TRANSACTION).doc(tranId);

  // Calculate discount.
  const dataMember: Member = docMember.data();
  let discount = 1;

  // We must apply discount.
  if (docCollectionData.discounts?.length) {
    const membersXp: number = dataMember.spaces?.[docCollectionData.space]?.totalReputation || 0;
    for (const d of docCollectionData.discounts.sort((a, b) => {
      return a.xp - b.xp;
    })) {
      if (Number(d.xp) < membersXp) {
        discount = (1 - d.amount);
      }
    }
  }

  // Lock NFT
  await admin.firestore().runTransaction(async (transaction) => {
    const sfDoc: DocumentSnapshotType = await transaction.get(refNft);
    if (sfDoc.data()) {
      // Was locked by another transaction.
      if (sfDoc.data().locked) {
        throw throwInvalidArgument(WenError.nft_locked_for_sale);
      }

      transaction.update(refNft, {
        locked: true,
        lockedBy: tranId
      });
    }
  });
  let finalPrice = (discount < 1 && !docNft.data().owner) ? Math.ceil(discount * docNftData.price) : (docNftData.availablePrice || docNftData.price);
  if (finalPrice < MIN_AMOUNT_TO_TRANSFER) {
    finalPrice = MIN_AMOUNT_TO_TRANSFER;
  }

  // Remove unwanted decimals.
  finalPrice = Math.floor((finalPrice / 1000 / 10)) * 1000 * 10; // Max two decimals on Mi.
  await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic);
  await refTran.set(<Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: docCollectionData.space,
    createdOn: serverTime(),
    payload: {
      type: TransactionOrderType.NFT_PURCHASE,
      amount: finalPrice,
      targetAddress: targetAddress.bech32,
      beneficiary: docNft.data().owner ? 'member' : 'space',
      beneficiaryUid: docNft.data().owner || docCollectionData.space,
      beneficiaryAddress: getAddress(docNft.data().owner ? prevOwnerAddress : docSpace.data()?.validatedAddress, Network.IOTA),
      royaltiesFee: docCollectionData.royaltiesFee,
      royaltiesSpace: docCollectionData.royaltiesSpace,
      royaltiesSpaceAddress: getAddress(docRoyaltySpace.data()?.validatedAddress, Network.IOTA),
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      nft: docNftData.uid,
      collection: docCollectionData.uid
    },
    linkedTransactions: []
  });

  // Load latest
  const docTrans = await refTran.get();

  // Return member.
  return <Transaction>docTrans.data();
});

export const validateAddress: functions.CloudFunction<Transaction> = functions.runWith({
  minInstances: scale(WEN_FUNC.validateAddress),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext): Promise<Transaction> => {
  appCheck(WEN_FUNC.validateAddress, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object(merge(getDefaultParams(), {
    space: Joi.string().length(ethAddressLength).lowercase().optional(),
    targetNetwork: Joi.string().equal(...Object.values(Network)).optional()
  }));
  assertValidation(schema.validate(params.body));

  const docMember = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const isSpaceValidation = !!params.body.space;
  let docSpace!: DocumentSnapshotType;
  if (isSpaceValidation) {
    const refSpace = admin.firestore().collection(COL.SPACE).doc(params.body.space);
    await SpaceValidator.spaceExists(refSpace);
    docSpace = await refSpace.get();
  }

  if (isSpaceValidation && getAddress(docSpace.data().validatedAddress, params.body.targetNetwork)) {
    throw throwInvalidArgument(WenError.space_already_have_validated_address);
  } else if (!isSpaceValidation && getAddress(docMember.data()?.validatedAddress, params.body.targetNetwork)) {
    throw throwInvalidArgument(WenError.member_already_have_validated_address);
  }

  // Get new target address.
  const newWallet = WalletService.newWallet(params.body.targetNetwork);
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  // Document does not exists.
  const tranId = getRandomEthAddress();
  const refTran = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
  await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic, params.body.targetNetwork);
  await refTran.set(<Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: isSpaceValidation ? params.body.space : null,
    createdOn: serverTime(),
    sourceNetwork: params.body.targetNetwork || DEFAULT_NETWORK,
    targetNetwork: params.body.targetNetwork || DEFAULT_NETWORK,
    payload: {
      type: isSpaceValidation ? TransactionOrderType.SPACE_ADDRESS_VALIDATION : TransactionOrderType.MEMBER_ADDRESS_VALIDATION,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      beneficiary: isSpaceValidation ? 'space' : 'member',
      beneficiaryUid: isSpaceValidation ? params.body.space : owner,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null
    },
    linkedTransactions: []
  });

  // Load latest
  const docTrans: DocumentSnapshotType = await refTran.get();

  // Return member.
  return <Transaction>docTrans.data();
});

export const openBid = functions.runWith({
  minInstances: scale(WEN_FUNC.openBid),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.openBid, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object({ nft: Joi.string().length(ethAddressLength).lowercase().required() });
  assertValidation(schema.validate(params.body));

  const docMember = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }
  const refNft = admin.firestore().collection(COL.NFT).doc(params.body.nft);
  const nft = <Nft | undefined>(await refNft.get()).data();
  if (!nft) {
    throw throwInvalidArgument(WenError.nft_does_not_exists);
  }

  if (isProdEnv()) {
    await assertIpNotBlocked(context.rawRequest?.ip || '', refNft.id, 'nft')
  }

  const refCollection = admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`);
  const collection = <Collection>(await refCollection.get()).data();
  const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${collection.space}`).get()).data();

  if (!collection.approved) {
    throw throwInvalidArgument(WenError.collection_must_be_approved);
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

  const prevOwnerAddress = (await admin.firestore().doc(`${COL.MEMBER}/${nft.owner}`).get()).data()?.validatedAddress
  assertMemberHasValidAddress(prevOwnerAddress, Network.IOTA)

  const newWallet = WalletService.newWallet();
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  const refRoyaltySpace = admin.firestore().collection(COL.SPACE).doc(collection.royaltiesSpace);
  const docRoyaltySpace = await refRoyaltySpace.get();

  const tranId = getRandomEthAddress();
  const transactionDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`);

  const finalPrice = Number(Math.max(nft.auctionFloorPrice || MIN_AMOUNT_TO_TRANSFER, MIN_AMOUNT_TO_TRANSFER).toPrecision(2));
  await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic);

  await transactionDocRef.set(<Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: collection.space,
    createdOn: serverTime(),
    payload: {
      type: TransactionOrderType.NFT_BID,
      amount: finalPrice,
      targetAddress: targetAddress.bech32,
      beneficiary: nft.owner ? 'member' : 'space',
      beneficiaryUid: nft.owner || collection.space,
      beneficiaryAddress: getAddress(nft.owner ? prevOwnerAddress : space.validatedAddress, Network.IOTA),
      royaltiesFee: collection.royaltiesFee,
      royaltiesSpace: collection.royaltiesSpace,
      royaltiesSpaceAddress: getAddress(docRoyaltySpace.data()?.validatedAddress, Network.IOTA),
      expiresOn: nft.auctionTo,
      reconciled: false,
      validationType: TransactionValidationType.ADDRESS,
      void: false,
      chainReference: null,
      nft: nft.uid,
      collection: collection.uid
    },
    linkedTransactions: []
  });

  return <Transaction>(await transactionDocRef.get()).data();
});
