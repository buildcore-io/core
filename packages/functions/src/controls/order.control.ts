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
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { WalletService } from '../services/wallet/wallet';
import { assertMemberHasValidAddress, getAddress } from '../utils/address.utils';
import { isProdEnv } from '../utils/config.utils';
import { cOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertIpNotBlocked } from '../utils/ip.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

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
