import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  DEFAULT_NETWORK,
  MAX_IOTA_AMOUNT,
  Member,
  MIN_IOTA_AMOUNT,
  Nft,
  NftAccess,
  NftAvailableFromDateMin,
  NftStatus,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
  URL_PATHS,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { merge } from 'lodash';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress, getAddress } from '../../utils/address.utils';
import { isProdEnv, networks } from '../../utils/config.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync, getDefaultParams } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { AVAILABLE_NETWORKS } from '../common';

const nftCreateSchema = {
  name: Joi.string().allow(null, '').required(),
  description: Joi.string().allow(null, '').required(),
  collection: CommonJoi.uid(),
  media: CommonJoi.storageUrl(false),
  // On test we allow now.
  availableFrom: Joi.date()
    .greater(
      dayjs()
        .add(isProdEnv() ? NftAvailableFromDateMin.value : -600000, 'ms')
        .toDate(),
    )
    .required(),
  // Minimum 10Mi price required and max 1Ti
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
  url: Joi.string()
    .allow(null, '')
    .uri({
      scheme: ['https', 'http'],
    })
    .optional(),
  // TODO Validate.
  properties: Joi.object().optional(),
  stats: Joi.object().optional(),
};

export const createNft = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cNft),
  })
  .https.onCall(async (req, context) => {
    appCheck(WEN_FUNC.cNft, context);
    const params = await decodeAuth(req, WEN_FUNC.cNft);
    const creator = params.address.toLowerCase();
    const schema = Joi.object(nftCreateSchema);
    await assertValidationAsync(schema, params.body);

    const collection = <Collection | undefined>(
      (await admin.firestore().doc(`${COL.COLLECTION}/${params.body.collection}`).get()).data()
    );
    if (!collection) {
      throw throwInvalidArgument(WenError.collection_does_not_exists);
    }
    if (collection.status !== CollectionStatus.PRE_MINTED) {
      throw throwInvalidArgument(WenError.invalid_collection_status);
    }
    return await processOneCreateNft(creator, params.body, collection, collection.total + 1);
  });

export const createBatchNft = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cBatchNft),
    timeoutSeconds: 300,
    memory: '4GB',
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.cBatchNft, context);

    const params = await decodeAuth(req, WEN_FUNC.cBatchNft);
    const creator = params.address.toLowerCase();
    const schema = Joi.array().items(Joi.object().keys(nftCreateSchema)).min(1).max(500);
    await assertValidationAsync(schema, params.body);

    // TODO What happens if they submit various collection. We need JOI to only allow same collection within all nfts.
    const collection = <Collection | undefined>(
      (await admin.firestore().doc(`${COL.COLLECTION}/${params.body[0].collection}`).get()).data()
    );
    if (!collection) {
      throw throwInvalidArgument(WenError.collection_does_not_exists);
    }
    if ((collection.status || CollectionStatus.PRE_MINTED) !== CollectionStatus.PRE_MINTED) {
      throw throwInvalidArgument(WenError.invalid_collection_status);
    }

    const promises = params.body.map((b: Nft, i: number) =>
      processOneCreateNft(creator, b, collection, collection.total + i + 1),
    );
    return (await Promise.all(promises)).map((n) => n.uid);
  });

const processOneCreateNft = async (
  creator: string,
  params: Nft,
  collectionData: Collection,
  position: number,
) => {
  const memberDocRef = await admin.firestore().collection(COL.MEMBER).doc(creator).get();
  if (!memberDocRef.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if (collectionData.createdBy !== creator) {
    throw throwInvalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  if (params.availableFrom) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params.availableFrom = dateToTimestamp(<any>params.availableFrom, true);
  }

  if (
    !collectionData.availableFrom ||
    dayjs(collectionData.availableFrom.toDate()).isAfter(
      dayjs(params.availableFrom?.toDate()),
      'minutes',
    )
  ) {
    throw throwInvalidArgument(
      WenError.nft_date_must_be_after_or_same_with_collection_available_from_date,
    );
  }

  if (collectionData.rejected) {
    throw throwInvalidArgument(WenError.collection_is_already_rejected);
  }

  if (collectionData.approved === true && collectionData.limitedEdition) {
    throw throwInvalidArgument(WenError.this_is_limited_addition_collection);
  }

  if (
    collectionData.type === CollectionType.GENERATED ||
    collectionData.type === CollectionType.SFT
  ) {
    params.price = collectionData.price || 0;
    params.availableFrom = collectionData.availableFrom || collectionData.createdOn;
  }

  const nftId = getRandomEthAddress();
  const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nftId}`);
  const price =
    isNaN(params.price) || params.price < MIN_IOTA_AMOUNT ? MIN_IOTA_AMOUNT : params.price;
  await nftDocRef.set(
    cOn(
      merge(params, {
        uid: nftId,
        locked: false,
        price,
        availablePrice: price,
        position: position,
        lockedBy: null,
        ipfsMedia: null,
        ipfsMetadata: null,
        sold: false,
        approved: collectionData.approved,
        rejected: collectionData.rejected,
        owner: null,
        soldOn: null,
        ipfsRetries: 0,
        space: collectionData.space,
        type: collectionData.type,
        hidden: CollectionType.CLASSIC !== collectionData.type,
        createdBy: creator,
        placeholderNft: false,
        status: CollectionStatus.PRE_MINTED,
      }),
      URL_PATHS.NFT,
    ),
  );

  await admin
    .firestore()
    .doc(`${COL.COLLECTION}/${collectionData.uid}`)
    .update(
      uOn({
        total: admin.firestore.FieldValue.increment(1),
      }),
    );

  if (collectionData.placeholderNft) {
    await admin
      .firestore()
      .doc(`${COL.NFT}/${collectionData.placeholderNft}`)
      .update(
        uOn({
          sold: false,
          availableFrom: params.availableFrom,
          hidden: false,
        }),
      );
  }

  return <Nft>(await nftDocRef.get()).data();
};

export const updateUnsoldNft = functions
  .runWith({
    minInstances: scale(WEN_FUNC.updateUnsoldNft),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.setForSaleNft, context);
    const params = await decodeAuth(req, WEN_FUNC.setForSaleNft);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({
      uid: CommonJoi.uid(),
      price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
    });
    await assertValidationAsync(schema, params.body);

    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${params.body.uid}`);

    await admin.firestore().runTransaction(async (transaction) => {
      const nft = <Nft | undefined>(await transaction.get(nftDocRef)).data();
      if (!nft) {
        throw throwInvalidArgument(WenError.nft_does_not_exists);
      }
      if (nft.sold) {
        throw throwInvalidArgument(WenError.nft_already_sold);
      }
      if (nft.placeholderNft) {
        throw throwInvalidArgument(WenError.nft_placeholder_cant_be_updated);
      }
      if (nft.hidden) {
        throw throwInvalidArgument(WenError.hidden_nft);
      }
      await assertIsGuardian(nft.space, owner);

      transaction.update(nftDocRef, uOn(params.body));
    });
    return <Nft>(await nftDocRef.get()).data();
  });

const makeAvailableForSaleJoi = merge(getDefaultParams(), {
  nft: CommonJoi.uid().required(),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT),
  availableFrom: Joi.date().greater(dayjs().subtract(600000, 'ms').toDate()),
  auctionFrom: Joi.date().greater(dayjs().subtract(600000, 'ms').toDate()),
  auctionFloorPrice: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT),
  auctionLength: Joi.number().min(TRANSACTION_AUTO_EXPIRY_MS).max(TRANSACTION_MAX_EXPIRY_MS),
  access: Joi.number().equal(NftAccess.OPEN, NftAccess.MEMBERS),
  accessMembers: Joi.when('access', {
    is: Joi.exist().valid(NftAccess.MEMBERS),
    then: Joi.array().items(CommonJoi.uid(false)).min(1),
  }),
});

export const setForSaleNft = functions
  .runWith({
    minInstances: scale(WEN_FUNC.setForSaleNft),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.setForSaleNft, context);
    const params = await decodeAuth(req, WEN_FUNC.setForSaleNft);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(makeAvailableForSaleJoi);
    await assertValidationAsync(schema, params.body);

    const member = <Member | undefined>(
      (await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
    );
    if (!member) {
      throw throwInvalidArgument(WenError.member_does_not_exists);
    }

    const nftDocRef = admin.firestore().collection(COL.NFT).doc(params.body.nft.toLowerCase());
    const nft = <Nft | undefined>(await nftDocRef.get()).data();
    if (!nft) {
      throw throwInvalidArgument(WenError.nft_does_not_exists);
    }

    if (nft.placeholderNft) {
      throw throwInvalidArgument(WenError.nft_placeholder_cant_be_updated);
    }

    if (nft.owner !== owner) {
      throw throwInvalidArgument(WenError.you_must_be_the_owner_of_nft);
    }

    const collection = <Collection>(
      (await admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`).get()).data()
    );

    if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection.status!)) {
      throw throwInvalidArgument(WenError.invalid_collection_status);
    }

    assertMemberHasValidAddress(member, nft.mintingData?.network || DEFAULT_NETWORK);

    if (params.body.availableFrom) {
      params.body.availableFrom = dateToTimestamp(params.body.availableFrom, true);
    }

    if (params.body.auctionFrom) {
      params.body.auctionFrom = dateToTimestamp(params.body.auctionFrom, true);
    }

    if (
      params.body.auctionFrom &&
      nft.auctionFrom &&
      dayjs(nft.auctionFrom.toDate()).isBefore(dayjs())
    ) {
      throw throwInvalidArgument(WenError.nft_auction_already_in_progress);
    }

    const update = <Nft>{
      saleAccess: params.body.access || NftAccess.OPEN,
      saleAccessMembers: params.body.accessMembers || [],
    };

    if (params.body.auctionFrom) {
      update.auctionFrom = params.body.auctionFrom;
      update.auctionTo = dateToTimestamp(
        dayjs(params.body.auctionFrom.toDate()).add(parseInt(params.body.auctionLength), 'ms'),
      );
      update.auctionFloorPrice = parseInt(params.body.auctionFloorPrice);
      update.auctionLength = parseInt(params.body.auctionLength);
      update.auctionHighestBid = 0;
      update.auctionHighestBidder = null;
      update.auctionHighestTransaction = null;
    } else {
      update.auctionFrom = null;
      update.auctionTo = null;
      update.auctionFloorPrice = null;
      update.auctionLength = null;
      update.auctionHighestBid = null;
      update.auctionHighestBidder = null;
      update.auctionHighestTransaction = null;
    }

    if (params.body.availableFrom) {
      update.availableFrom = params.body.availableFrom;
      update.availablePrice = parseInt(params.body.price);
    } else {
      update.availableFrom = null;
      update.availablePrice = null;
    }

    await nftDocRef.update(uOn(update));

    return <Nft>(await nftDocRef.get()).data();
  });

export const withdrawNft = functions
  .runWith({
    minInstances: scale(WEN_FUNC.withdrawNft),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.withdrawNft, context);
    const params = await decodeAuth(req, WEN_FUNC.withdrawNft);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({ nft: CommonJoi.uid() });
    await assertValidationAsync(schema, params.body);

    await admin.firestore().runTransaction(async (transaction) => {
      const nftDocRef = admin.firestore().doc(`${COL.NFT}/${params.body.nft}`);
      const nft = <Nft | undefined>(await transaction.get(nftDocRef)).data();
      if (!nft) {
        throw throwInvalidArgument(WenError.nft_does_not_exists);
      }

      if (nft.owner !== owner) {
        throw throwInvalidArgument(WenError.you_must_be_the_owner_of_nft);
      }

      if (nft.status !== NftStatus.MINTED) {
        throw throwInvalidArgument(WenError.nft_not_minted);
      }

      if (nft.availableFrom || nft.auctionFrom) {
        throw throwInvalidArgument(WenError.nft_on_sale);
      }

      const member = <Member | undefined>(
        (await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
      );

      assertMemberHasValidAddress(member, nft.mintingData?.network!);

      const order = <Transaction>{
        type: TransactionType.WITHDRAW_NFT,
        uid: getRandomEthAddress(),
        member: owner,
        space: nft.space,
        network: nft.mintingData?.network,
        payload: {
          amount: nft.depositData?.storageDeposit || nft.mintingData?.storageDeposit || 0,
          sourceAddress: nft.depositData?.address || nft.mintingData?.address,
          targetAddress: getAddress(member, nft.mintingData?.network!),
          collection: nft.collection,
          nft: nft.uid,
        },
      };
      transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`), cOn(order));
      transaction.update(
        nftDocRef,
        uOn({
          status: NftStatus.WITHDRAWN,
          hidden: true,
          depositData: admin.firestore.FieldValue.delete(),
        }),
      );
    });
  });

export const depositNft = functions
  .runWith({
    minInstances: scale(WEN_FUNC.depositNft),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.depositNft, context);
    const params = await decodeAuth(req, WEN_FUNC.depositNft);
    const owner = params.address.toLowerCase();
    const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));
    const schema = Joi.object({
      network: Joi.string()
        .equal(...availaibleNetworks)
        .required(),
    });
    await assertValidationAsync(schema, params.body);

    return await admin.firestore().runTransaction(async (transaction) => {
      const network = params.body.network;
      const wallet = await WalletService.newWallet(network);
      const targetAddress = await wallet.getNewIotaAddressDetails();

      const order = <Transaction>{
        type: TransactionType.ORDER,
        uid: getRandomEthAddress(),
        member: owner,
        space: '',
        network,
        payload: {
          type: TransactionOrderType.DEPOSIT_NFT,
          targetAddress: targetAddress.bech32,
          validationType: TransactionValidationType.ADDRESS,
          expiresOn: dateToTimestamp(
            dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
          ),
          reconciled: false,
          void: false,
        },
      };
      transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`), cOn(order));
      return order;
    });
  });
