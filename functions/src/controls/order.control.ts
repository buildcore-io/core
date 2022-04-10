import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { MIN_AMOUNT_TO_TRANSFER } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, WEN_FUNC } from '../../interfaces/functions/index';
import { Member, Transaction } from '../../interfaces/models';
import { COL, SUB_COL, WenRequest } from '../../interfaces/models/base';
import { DocumentSnapshotType } from '../../interfaces/models/firebase';
import { scale } from "../scale.settings";
import { CommonJoi } from '../services/joi/common';
import { dateToTimestamp, serverTime } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { assertValidation, getDefaultParams } from "../utils/schema.utils";
import { decodeAuth, getRandomEthAddress } from "../utils/wallet.utils";
import { Collection, CollectionAccess, CollectionType } from './../../interfaces/models/collection';
import { Nft, NftAccess } from './../../interfaces/models/nft';
import { TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from './../../interfaces/models/transaction';
import { SpaceValidator } from './../services/validators/space';
import { MnemonicService } from './../services/wallet/mnemonic';
import { AddressDetails, WalletService } from './../services/wallet/wallet';
import { ethAddressLength } from './../utils/wallet.utils';

export const orderNft: functions.CloudFunction<Transaction> = functions.runWith({
  minInstances: scale(WEN_FUNC.orderNft),
}).https.onCall(async (req: WenRequest, context: any): Promise<Transaction> => {
  appCheck(WEN_FUNC.orderNft, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema: ObjectSchema<any> = Joi.object(merge(getDefaultParams(), {
    collection: CommonJoi.uidCheck(),
    nft: Joi.string().length(ethAddressLength).lowercase().optional()
  }));
  assertValidation(schema.validate(params.body));

  const docMember: DocumentSnapshotType = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const refCollection: admin.firestore.DocumentReference = admin.firestore().collection(COL.COLLECTION).doc(params.body.collection);
  const docCollection: DocumentSnapshotType = await refCollection.get();
  const docCollectionData: Collection = docCollection.data();
  const refSpace: admin.firestore.DocumentReference = admin.firestore().collection(COL.SPACE).doc(docCollectionData.space);
  const docSpace: DocumentSnapshotType = await refSpace.get();

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
      const nftAbove: FirebaseFirestore.QuerySnapshot<any> = await admin.firestore().collection(COL.NFT)
        .where('sold', '==', false)
        .where('locked', '==', false)
        .where('placeholderNft', '==', false)
        .where('collection', '==', docCollectionData.uid)
        .where('position', '>=', randNumber).orderBy('position', 'asc').limit(1).get();
      const nftBelow: FirebaseFirestore.QuerySnapshot<any> = await admin.firestore().collection(COL.NFT)
        .where('sold', '==', false)
        .where('locked', '==', false)
        .where('placeholderNft', '==', false)
        .where('collection', '==', docCollectionData.uid)
        .where('position', '<=', randNumber).orderBy('position', 'desc').limit(1).get();
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

  if (!docNftData.owner && docCollectionData.access === CollectionAccess.MEMBERS_ONLY) {
    if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(owner).get()).exists) {
      throw throwInvalidArgument(WenError.you_are_not_part_of_space);
    }
  }

  if (!docNftData.owner && docCollectionData.access === CollectionAccess.GUARDIANS_ONLY) {
    if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get()).exists) {
      throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
    }
  }

  if (!docNftData.owner && docCollectionData.access === CollectionAccess.MEMBERS_WITH_BADGE) {
    const includedBadges: string[] = [];
    const qry: admin.firestore.QuerySnapshot = await admin.firestore().collection(COL.TRANSACTION)
               .where('type', '==', TransactionType.BADGE)
               .where('member', '==', owner).get();
    if (qry.size > 0 && docCollectionData.accessAwards?.length) {
      for (const t of qry.docs) {
        if (docCollectionData.accessAwards.includes(t.data().payload.award) && !includedBadges.includes(t.data().payload.award)) {
          includedBadges.push(t.data().payload.award)
          break;
        }
      }
    }

    if (docCollectionData.accessAwards.length !== includedBadges.length) {
      throw throwInvalidArgument(WenError.you_dont_have_required_badge);
    }
  }

  if (!docNftData.owner && docCollectionData.access === CollectionAccess.MEMBERS_WITH_NFT_FROM_COLLECTION) {
    const includedCollections: string[] = [];
    const qry: admin.firestore.QuerySnapshot = await admin.firestore().collection(COL.NFT)
               .where('owner', '==', owner).get();
    if (qry.size > 0 && docCollectionData.accessCollections?.length) {
      for (const t of qry.docs) {
        if (docCollectionData.accessCollections.includes(t.data().collection) && !includedCollections.includes(t.data().collection)) {
          includedCollections.push(t.data().collection);
          break;
        }
      }
    }

    if (docCollectionData.accessCollections.length !== includedCollections.length) {
      throw throwInvalidArgument(WenError.you_dont_have_required_NFTs);
    }
  }

  if (!docNftData.owner && docCollectionData.onePerMemberOnly === true) {
    const qry: admin.firestore.QuerySnapshot = await admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', owner)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.royalty', '==', false)
      .where('payload.collection', '==', docCollectionData.uid)
      .where('payload.previusOwnerEntity', '==', 'space').get();
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
  let prevOwnerAddress: string|undefined = undefined;
  if (docNft.data().owner) { // &&
    const refPrevOwner: admin.firestore.DocumentReference = admin.firestore().collection(COL.MEMBER).doc(docNft.data().owner);
    const docPrevOwner: DocumentSnapshotType = await refPrevOwner.get();
    if (!docPrevOwner.data()?.validatedAddress) {
      throw throwInvalidArgument(WenError.member_must_have_validated_address);
    } else {
      prevOwnerAddress = docPrevOwner.data()?.validatedAddress;
    }
  } else if (!docSpace.data().validatedAddress) {
    throw throwInvalidArgument(WenError.space_must_have_validated_address);
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
  const newWallet: WalletService = new WalletService();
  const targetAddress: AddressDetails = await newWallet.getNewIotaAddressDetails();
  const refRoyaltySpace: admin.firestore.DocumentReference = admin.firestore().collection(COL.SPACE).doc(docCollectionData.royaltiesSpace);
  const docRoyaltySpace: DocumentSnapshotType = await refRoyaltySpace.get();

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
      beneficiaryAddress: docNft.data().owner ? prevOwnerAddress : docSpace.data().validatedAddress,
      royaltiesFee: docCollectionData.royaltiesFee,
      royaltiesSpace: docCollectionData.royaltiesSpace,
      royaltiesSpaceAddress: docRoyaltySpace.data().validatedAddress,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      nft: docNftData.uid,
      collection: docCollectionData.uid
    }
  });

  // Load latest
  const docTrans = await refTran.get();

  // Return member.
  return <Transaction>docTrans.data();
});

export const validateAddress: functions.CloudFunction<Transaction> = functions.runWith({
  minInstances: scale(WEN_FUNC.validateAddress),
}).https.onCall(async (req: WenRequest, context: any): Promise<Transaction> => {
  appCheck(WEN_FUNC.validateAddress, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema: ObjectSchema<any> = Joi.object(merge(getDefaultParams(), {
    space: Joi.string().length(ethAddressLength).lowercase().optional()
  }));
  assertValidation(schema.validate(params.body));

  const docMember: DocumentSnapshotType = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const isSpaceValidation = !!params.body.space;
  let docSpace!: DocumentSnapshotType;
  if (isSpaceValidation) {
    const refSpace: admin.firestore.DocumentReference = admin.firestore().collection(COL.SPACE).doc(params.body.space);
    await SpaceValidator.spaceExists(refSpace);
    docSpace = await refSpace.get();
  }

  if (isSpaceValidation && docSpace.data().validatedAddress) {
    throw throwInvalidArgument(WenError.space_already_have_validated_address);
  } else if (!isSpaceValidation && docMember.data().validatedAddress) {
    throw throwInvalidArgument(WenError.member_already_have_validated_address);
  }

  // Get new target address.
  const newWallet: WalletService = new WalletService();
  const targetAddress: AddressDetails = await newWallet.getNewIotaAddressDetails();
  const min = (MIN_AMOUNT_TO_TRANSFER / 1000 / 10); // Reduce number of decimals.
  const randomAmount: number = (Math.floor(Math.random() * ((min * 1.5) - min + 1) + min) * 1000 * 10);
  // Document does not exists.
  const tranId: string = getRandomEthAddress();
  const refTran: admin.firestore.DocumentReference = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
  await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic);
  await refTran.set(<Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: isSpaceValidation ? params.body.space : null,
    createdOn: serverTime(),
    payload: {
      type: isSpaceValidation ? TransactionOrderType.SPACE_ADDRESS_VALIDATION : TransactionOrderType.MEMBER_ADDRESS_VALIDATION,
      amount: randomAmount,
      targetAddress: targetAddress.bech32,
      beneficiary: isSpaceValidation ? 'space' : 'member',
      beneficiaryUid: isSpaceValidation ? params.body.space : owner,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null
    }
  });

  // Load latest
  const docTrans: DocumentSnapshotType = await refTran.get();

  // Return member.
  return <Transaction>docTrans.data();
});

export const openBid: functions.CloudFunction<Transaction> = functions.runWith({
  minInstances: scale(WEN_FUNC.openBid),
}).https.onCall(async (req: WenRequest, context: any): Promise<Transaction> => {
  appCheck(WEN_FUNC.openBid, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema: ObjectSchema<any> = Joi.object(merge(getDefaultParams(), {
    nft: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const docMember: DocumentSnapshotType = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }
  const refNft: admin.firestore.DocumentReference= admin.firestore().collection(COL.NFT).doc(params.body.nft);
  const docNft: DocumentSnapshotType = await refNft.get();
  const docNftData: Nft = docNft.data();
  if (!docNft.exists) {
    throw throwInvalidArgument(WenError.nft_does_not_exists);
  }

  const refCollection: admin.firestore.DocumentReference = admin.firestore().collection(COL.COLLECTION).doc(docNftData.collection);
  const docCollection: DocumentSnapshotType = await refCollection.get();
  const docCollectionData: Collection = docCollection.data();
  const refSpace: admin.firestore.DocumentReference = admin.firestore().collection(COL.SPACE).doc(docCollectionData.space);
  const docSpace: DocumentSnapshotType = await refSpace.get();

  // Collection must be approved.
  if (!docCollectionData.approved) {
    throw throwInvalidArgument(WenError.collection_must_be_approved);
  }

  if (docNftData.saleAccess === NftAccess.MEMBERS && !(docNftData.saleAccessMembers || []).includes(owner)) {
    throw throwInvalidArgument(WenError.you_are_not_allowed_member_to_purchase_this_nft);
  }

  if (!docNftData.auctionFrom) {
    throw throwInvalidArgument(WenError.nft_not_available_for_sale);
  }

  if (docNft.data().placeholderNft) {
    throw throwInvalidArgument(WenError.nft_placeholder_cant_be_purchased);
  }

  if (docNft.data().owner === owner) {
    throw throwInvalidArgument(WenError.you_cant_buy_your_nft);
  }

  // Extra check to make sure owner address is defined.
  let prevOwnerAddress: string|undefined = undefined;
  const refPrevOwner: admin.firestore.DocumentReference = admin.firestore().collection(COL.MEMBER).doc(docNft.data().owner);
  const docPrevOwner: DocumentSnapshotType = await refPrevOwner.get();
  if (!docPrevOwner.data()?.validatedAddress) {
    throw throwInvalidArgument(WenError.member_must_have_validated_address);
  } else {
    prevOwnerAddress = docPrevOwner.data()?.validatedAddress;
  }

  // Get new target address.
  const newWallet: WalletService = new WalletService();
  const targetAddress: AddressDetails = await newWallet.getNewIotaAddressDetails();
  const refRoyaltySpace: admin.firestore.DocumentReference = admin.firestore().collection(COL.SPACE).doc(docCollectionData.royaltiesSpace);
  const docRoyaltySpace: DocumentSnapshotType = await refRoyaltySpace.get();

  // Document does not exists.
  const tranId: string = getRandomEthAddress();
  const refTran: admin.firestore.DocumentReference = admin.firestore().collection(COL.TRANSACTION).doc(tranId);

  let finalPrice = docNftData.auctionFloorPrice || MIN_AMOUNT_TO_TRANSFER;
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
      type: TransactionOrderType.NFT_BID,
      amount: finalPrice,
      targetAddress: targetAddress.bech32,
      beneficiary: docNft.data().owner ? 'member' : 'space',
      beneficiaryUid: docNft.data().owner || docCollectionData.space,
      beneficiaryAddress: docNft.data().owner ? prevOwnerAddress : docSpace.data().validatedAddress,
      royaltiesFee: docCollectionData.royaltiesFee,
      royaltiesSpace: docCollectionData.royaltiesSpace,
      royaltiesSpaceAddress: docRoyaltySpace.data().validatedAddress,
      expiresOn: docNft.data().auctionTo,
      reconciled: false,
      validationType: TransactionValidationType.ADDRESS,
      void: false,
      chainReference: null,
      nft: docNftData.uid,
      collection: docCollectionData.uid
    }
  });

  // Load latest
  const docTrans = await refTran.get();

  // Return member.
  return <Transaction>docTrans.data();
});
