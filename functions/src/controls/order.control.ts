import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, WEN_FUNC } from '../../interfaces/functions/index';
import { Transaction } from '../../interfaces/models';
import { COL, WenRequest } from '../../interfaces/models/base';
import { scale } from "../scale.settings";
import { CommonJoi } from '../services/joi/common';
import { serverTime } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { assertValidation, getDefaultParams } from "../utils/schema.utils";
import { decodeAuth, getRandomEthAddress } from "../utils/wallet.utils";
import { Collection } from './../../interfaces/models/collection';
import { Nft } from './../../interfaces/models/nft';
import { TransactionOrderType, TransactionType } from './../../interfaces/models/transaction';
import { SpaceValidator } from './../services/validators/space';
import { MnemonicService } from './../services/wallet/mnemonic';
import { AddressDetails, MIN_AMOUNT_TO_TRANSFER, WalletService } from './../services/wallet/wallet';
import { ethAddressLength } from './../utils/wallet.utils';

export const orderNft: functions.CloudFunction<Transaction> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: scale(WEN_FUNC.orderNft),
}).https.onCall(async (req: WenRequest, context: any): Promise<Transaction> => {
  appCheck(WEN_FUNC.orderNft, context);
  // Validate auth details before we continue
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema: ObjectSchema<any> = Joi.object(merge(getDefaultParams(), {
    nft: CommonJoi.uidCheck()
  }));
  assertValidation(schema.validate(params.body));

  const docMember: any = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const refNft: any = admin.firestore().collection(COL.NFT).doc(params.body.nft);
  const docNft: any = await refNft.get();
  if (!docNft.exists) {
    throw throwInvalidArgument(WenError.nft_does_not_exists);
  }
  const docNftData: Nft = docNft.data();
  const refCollection: any = admin.firestore().collection(COL.COLLECTION).doc(docNft.data().collection);
  const docCollection: any = await refCollection.get();
  const docCollectionData: Collection = docCollection.data();

  // Extra check to make sure owner address is defined.
  if (docNft.data().owner && !docNft.data().ownerAddress) {
    throw throwInvalidArgument(WenError.member_must_have_validated_address);
  } else if (!docMember.data().validatedAddress) {
    throw throwInvalidArgument(WenError.space_must_have_validated_address);
  }

  if (!docNft.data().availableFrom || dayjs(docNft.data().availableFrom.toDate()).isAfter(dayjs())) {
    throw throwInvalidArgument(WenError.nft_not_available_for_sale);
  }

  if (docNft.data().locked) {
    throw throwInvalidArgument(WenError.nft_locked_for_sale);
  }

  // Get new target address.
  const newWallet: WalletService = new WalletService();
  const targetAddress: AddressDetails = await newWallet.getNewIotaAddressDetails();

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(docCollectionData.space);
  const docSpace: any = await refSpace.get();

  const refRoyaltySpace: any = admin.firestore().collection(COL.SPACE).doc(docCollectionData.royaltiesSpace);
  const docRoyaltySpace: any = await refRoyaltySpace.get();

  // Document does not exists.
  const tranId: string = getRandomEthAddress();
  const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
  await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic);
  await refTran.set(<Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: docCollectionData.space,
    createdOn: serverTime(),
    payload: {
      type: TransactionOrderType.NFT_PURCHASE,
      amount: docNftData.price,
      targetAddress: targetAddress.bech32,
      beneficiary: docNft.data().owner ? 'member' : 'space',
      beneficiaryUid: docNft.data().owner || docCollectionData.space,
      beneficiaryAddress: docNft.data().owner ? docNft.data().ownerAddress : docSpace.data().validatedAddress,
      royaltiesFee: docCollectionData.royaltiesFee,
      royaltiesSpace: docCollectionData.royaltiesSpace,
      royaltiesSpaceAddress: docRoyaltySpace.data().validatedAddress,
      reconciled: false,
      chainReference: null,
      nft: docNftData.uid,
      collection: docCollectionData.uid
    }
  });

  // Lock NFT.
  await refNft.update({
    locked: true,
    lockedBy: tranId
  });

  // Load latest
  const docTrans = await refTran.get();

  // Return member.
  return <Transaction>docTrans.data();
});

export const validateAddress: functions.CloudFunction<Transaction> = functions.runWith({
  // Keep 1 instance so we never have cold start.
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

  const docMember: any = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const isSpaceValidation = !!params.body.space;
  let docSpace: any;
  if (isSpaceValidation) {
    const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.space);
    await SpaceValidator.spaceExists(refSpace);
    docSpace = refSpace.get();
  }

  if (isSpaceValidation && docSpace.data().validatedAddress) {
    throw throwInvalidArgument(WenError.space_already_have_validated_address);
  } else if (docMember.data().validatedAddress) {
    throw throwInvalidArgument(WenError.member_already_have_validated_address);
  }

  // Get new target address.
  const newWallet: WalletService = new WalletService();
  const targetAddress: AddressDetails = await newWallet.getNewIotaAddressDetails();
  const randomAmount: number = Math.floor(Math.random() * ((MIN_AMOUNT_TO_TRANSFER * 1.5) - MIN_AMOUNT_TO_TRANSFER + 1) + MIN_AMOUNT_TO_TRANSFER);
  // Document does not exists.
  const tranId: string = getRandomEthAddress();
  const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
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
      reconciled: false,
      chainReference: null
    }
  });

  // Load latest
  const docTrans = await refTran.get();

  // Return member.
  return <Transaction>docTrans.data();
});
