import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  DEFAULT_NETWORK,
  Member,
  MIN_AMOUNT_TO_TRANSFER,
  Nft,
  NftAccess,
  Space,
  SUB_COL,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { merge } from 'lodash';
import admin, { DocumentSnapshotType } from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { assertHasAccess } from '../services/validators/access';
import { WalletService } from '../services/wallet/wallet';
import {
  assertMemberHasValidAddress,
  assertSpaceHasValidAddress,
  getAddress,
} from '../utils/address.utils';
import { generateRandomAmount } from '../utils/common.utils';
import { isProdEnv, networks } from '../utils/config.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertIpNotBlocked } from '../utils/ip.utils';
import { assertValidationAsync, getDefaultParams } from '../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

const orderNftSchema = Joi.object(
  merge(getDefaultParams(), {
    collection: CommonJoi.uid(),
    nft: CommonJoi.uid(false).optional(),
  }),
);

export const orderNft: functions.CloudFunction<Transaction> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.orderNft),
  })
  .https.onCall(
    async (req: WenRequest, context: functions.https.CallableContext): Promise<Transaction> => {
      appCheck(WEN_FUNC.orderNft, context);
      // Validate auth details before we continue
      const params = await decodeAuth(req, WEN_FUNC.orderNft);
      const owner = params.address.toLowerCase();
      await assertValidationAsync(orderNftSchema, params.body);

      const member = <Member | undefined>(
        (await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
      );
      if (!member) {
        throw throwInvalidArgument(WenError.member_does_not_exists);
      }

      const collection = <Collection | undefined>(
        (await admin.firestore().doc(`${COL.COLLECTION}/${params.body.collection}`).get()).data()
      );
      if (!collection) {
        throw throwInvalidArgument(WenError.collection_does_not_exists);
      }

      const space = <Space>(
        (await admin.firestore().doc(`${COL.SPACE}/${collection.space}`).get()).data()
      );

      // Collection must be approved.
      if (!collection.approved) {
        throw throwInvalidArgument(WenError.collection_must_be_approved);
      }

      if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection.status!)) {
        throw throwInvalidArgument(WenError.invalid_collection_status);
      }

      // Let's determine if NFT can be indicated or we need to randomly select one.
      let refNft: admin.firestore.DocumentReference;
      let mustBeSold = false;
      if (collection.type === CollectionType.CLASSIC) {
        if (!params.body.nft) {
          throw throwInvalidArgument(WenError.nft_does_not_exists);
        }

        refNft = admin.firestore().collection(COL.NFT).doc(params.body.nft);
      } else {
        if (!params.body.nft) {
          // We need to go find the NFT for purchase.
          const randNumber: number = Math.floor(Math.random() * collection.total);
          // Above / below
          const nftAbove = await admin
            .firestore()
            .collection(COL.NFT)
            .where('sold', '==', false)
            .where('locked', '==', false)
            .where('placeholderNft', '==', false)
            .where('collection', '==', collection.uid)
            .where('position', '>=', randNumber)
            .orderBy('position', 'asc')
            .limit(1)
            .get();
          const nftBelow = await admin
            .firestore()
            .collection(COL.NFT)
            .where('sold', '==', false)
            .where('locked', '==', false)
            .where('placeholderNft', '==', false)
            .where('collection', '==', collection.uid)
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

      const nft = <Nft | undefined>(await refNft.get()).data();
      if (!nft) {
        throw throwInvalidArgument(WenError.nft_does_not_exists);
      }
      const network = nft.mintingData?.network || DEFAULT_NETWORK;

      if (isProdEnv()) {
        await assertIpNotBlocked(context.rawRequest?.ip || '', nft.uid, 'nft');
      }

      if (!nft.owner) {
        await assertHasAccess(
          space.uid,
          owner,
          collection.access,
          collection.accessAwards || [],
          collection.accessCollections || [],
        );
      }

      if (!nft.owner && collection.onePerMemberOnly === true) {
        const qry: admin.firestore.QuerySnapshot = await admin
          .firestore()
          .collection(COL.TRANSACTION)
          .where('member', '==', owner)
          .where('type', '==', TransactionType.BILL_PAYMENT)
          // Even if it's 100% royalty we don't ignore
          // .where('payload.royalty', '==', false)
          .where('payload.collection', '==', collection.uid)
          .where('payload.previousOwnerEntity', '==', 'space')
          .get();
        if (qry.size >= 1) {
          throw throwInvalidArgument(WenError.you_can_only_own_one_nft_from_collection);
        }
      }

      if (mustBeSold && !nft.owner) {
        throw throwInvalidArgument(WenError.generated_spf_nft_must_be_sold_first);
      }

      if (!nft.availableFrom || dayjs(nft.availableFrom.toDate()).isAfter(dayjs())) {
        throw throwInvalidArgument(WenError.nft_not_available_for_sale);
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

      // Extra check to make sure owner address is defined.
      let prevOwner: Member | undefined = undefined;
      if (nft.owner) {
        // &&
        const refPrevOwner = admin.firestore().collection(COL.MEMBER).doc(nft.owner);
        prevOwner = <Member | undefined>(await refPrevOwner.get()).data();
        assertMemberHasValidAddress(prevOwner, network);
      } else {
        assertSpaceHasValidAddress(space, network);
      }

      if (nft.owner === owner) {
        throw throwInvalidArgument(WenError.you_cant_buy_your_nft);
      }

      // Validate there isn't any order in progress.
      const orderInProgress: admin.firestore.QuerySnapshot = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('payload.reconciled', '==', false)
        .where('payload.type', '==', TransactionOrderType.NFT_PURCHASE)
        .where('member', '==', owner)
        .where('type', '==', TransactionType.ORDER)
        .where('payload.void', '==', false)
        .get();

      if (orderInProgress.size > 0) {
        throw throwInvalidArgument(WenError.you_have_currently_another_order_in_progress);
      }

      // Get new target address.
      const newWallet = await WalletService.newWallet(network);
      const targetAddress = await newWallet.getNewIotaAddressDetails();
      const refRoyaltySpace = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(collection.royaltiesSpace);
      const royaltySpace = <Space | undefined>(await refRoyaltySpace.get()).data();

      // Document does not exists.
      const tranId: string = getRandomEthAddress();
      const refTran: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .doc(tranId);

      // Calculate discount.
      let discount = 1;

      // We must apply discount.
      if (collection.discounts?.length) {
        const membersXp: number = member.spaces?.[collection.space]?.totalReputation || 0;
        for (const d of collection.discounts.sort((a, b) => {
          return a.xp - b.xp;
        })) {
          if (Number(d.xp) < membersXp) {
            discount = 1 - d.amount;
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

          transaction.update(
            refNft,
            uOn({
              locked: true,
              lockedBy: tranId,
            }),
          );
        }
      });
      let finalPrice =
        discount < 1 && !nft.owner
          ? Math.ceil(discount * nft.price)
          : nft.availablePrice || nft.price;
      if (finalPrice < MIN_AMOUNT_TO_TRANSFER) {
        finalPrice = MIN_AMOUNT_TO_TRANSFER;
      }

      // Remove unwanted decimals.
      finalPrice = Math.floor(finalPrice / 1000 / 10) * 1000 * 10; // Max two decimals on Mi.
      await refTran.set(
        cOn(<Transaction>{
          type: TransactionType.ORDER,
          uid: tranId,
          member: owner,
          space: collection.space,
          network,
          payload: {
            type: TransactionOrderType.NFT_PURCHASE,
            amount: finalPrice,
            targetAddress: targetAddress.bech32,
            beneficiary: nft.owner ? 'member' : 'space',
            beneficiaryUid: nft.owner || collection.space,
            beneficiaryAddress: getAddress(nft.owner ? prevOwner : space, network),
            royaltiesFee: collection.royaltiesFee,
            royaltiesSpace: collection.royaltiesSpace,
            royaltiesSpaceAddress: getAddress(royaltySpace, network),
            expiresOn: dateToTimestamp(
              dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
            ),
            validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
            reconciled: false,
            void: false,
            chainReference: null,
            nft: nft.uid,
            collection: collection.uid,
          },
          linkedTransactions: [],
        }),
      );

      // Load latest
      const docTrans = await refTran.get();

      // Return member.
      return <Transaction>docTrans.data();
    },
  );

export const validateAddress: functions.CloudFunction<Transaction> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.validateAddress),
  })
  .https.onCall(
    async (req: WenRequest, context: functions.https.CallableContext): Promise<Transaction> => {
      appCheck(WEN_FUNC.validateAddress, context);
      // Validate auth details before we continue
      const params = await decodeAuth(req, WEN_FUNC.validateAddress);
      const owner = params.address.toLowerCase();
      const schema = Joi.object(
        merge(getDefaultParams(), {
          space: CommonJoi.uid(false).optional(),
          network: Joi.string()
            .equal(...networks)
            .optional(),
        }),
      );
      await assertValidationAsync(schema, params.body);
      const network = params.body.network || DEFAULT_NETWORK;

      const member = <Member | undefined>(
        (await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
      );
      if (!member) {
        throw throwInvalidArgument(WenError.member_does_not_exists);
      }

      const space = params.body.space
        ? <Space | undefined>(
            (await admin.firestore().doc(`${COL.SPACE}/${params.body.space}`).get()).data()
          )
        : undefined;
      if (params.body.space && !space) {
        throw throwInvalidArgument(WenError.space_does_not_exists);
      }
      if (space) {
        const guardian = await admin
          .firestore()
          .doc(`${COL.SPACE}/${space.uid}/${SUB_COL.GUARDIANS}/${owner}`)
          .get();
        if (!guardian.exists) {
          throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
        }
        if (getAddress(space, network)) {
          throw throwInvalidArgument(WenError.space_already_have_validated_address);
        }
      }

      const wallet = await WalletService.newWallet(network);
      const targetAddress = await wallet.getNewIotaAddressDetails();
      const data = <Transaction>{
        type: TransactionType.ORDER,
        uid: getRandomEthAddress(),
        member: owner,
        space: space?.uid || null,
        network,
        payload: {
          type: space
            ? TransactionOrderType.SPACE_ADDRESS_VALIDATION
            : TransactionOrderType.MEMBER_ADDRESS_VALIDATION,
          amount: generateRandomAmount(),
          targetAddress: targetAddress.bech32,
          beneficiary: space ? 'space' : 'member',
          beneficiaryUid: space?.uid || owner,
          expiresOn: dateToTimestamp(
            dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
          ),
          validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
          reconciled: false,
          void: false,
          chainReference: null,
        },
        linkedTransactions: [],
      };
      await admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`).create(cOn(data));
      return data;
    },
  );

export const openBid = functions
  .runWith({
    minInstances: scale(WEN_FUNC.openBid),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.openBid, context);
    const params = await decodeAuth(req, WEN_FUNC.openBid);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({
      nft: CommonJoi.uid(),
    });
    await assertValidationAsync(schema, params.body);

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
      await assertIpNotBlocked(context.rawRequest?.ip || '', refNft.id, 'nft');
    }

    const refCollection = admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`);
    const collection = <Collection>(await refCollection.get()).data();
    const space = <Space>(
      (await admin.firestore().doc(`${COL.SPACE}/${collection.space}`).get()).data()
    );

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
    const prevOwner = <Member | undefined>(
      (await admin.firestore().doc(`${COL.MEMBER}/${nft.owner}`).get()).data()
    );
    assertMemberHasValidAddress(prevOwner, network);

    const newWallet = await WalletService.newWallet(network);
    const targetAddress = await newWallet.getNewIotaAddressDetails();
    const refRoyaltySpace = admin.firestore().collection(COL.SPACE).doc(collection.royaltiesSpace);
    const royaltySpace = <Space | undefined>(await refRoyaltySpace.get()).data();

    const tranId = getRandomEthAddress();
    const transactionDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`);

    const finalPrice = Number(
      Math.max(nft.auctionFloorPrice || MIN_AMOUNT_TO_TRANSFER, MIN_AMOUNT_TO_TRANSFER).toPrecision(
        2,
      ),
    );

    await transactionDocRef.set(
      cOn(<Transaction>{
        type: TransactionType.ORDER,
        uid: tranId,
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
      }),
    );

    return <Transaction>(await transactionDocRef.get()).data();
  });
