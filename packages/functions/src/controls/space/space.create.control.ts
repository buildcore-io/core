import {
  COL,
  GITHUB_REGEXP,
  Network,
  SUB_COL,
  TWITTER_REGEXP,
  URL_PATHS,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { WalletService } from '../../services/wallet/wallet';
import { isProdEnv } from '../../utils/config.utils';
import { cOn } from '../../utils/dateTime.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';

export const spaceUpsertSchema = {
  name: Joi.string().allow(null, '').optional(),
  about: Joi.string().allow(null, '').optional(),
  open: Joi.boolean().allow(false, true).optional(),
  discord: Joi.string().allow(null, '').alphanum().optional(),
  github: Joi.string().allow(null, '').regex(GITHUB_REGEXP).optional(),
  twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional(),
  avatarUrl: CommonJoi.storageUrl(false),
  bannerUrl: CommonJoi.storageUrl(false),
};

export const createSpace = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cSpace),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.cSpace, context);
    const params = await decodeAuth(req, WEN_FUNC.cSpace);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(spaceUpsertSchema);
    await assertValidationAsync(schema, params.body);

    const wallet = await WalletService.newWallet(isProdEnv() ? Network.SMR : Network.RMS);
    const vaultAddress = await wallet.getNewIotaAddressDetails();

    const space = {
      uid: getRandomEthAddress(),
      ...params.body,
      createdBy: owner,
      open: params.body.open === false ? false : true,
      totalMembers: 1,
      totalGuardians: 1,
      totalPendingMembers: 0,
      rank: 1,
      vaultAddress: vaultAddress.bech32,
    };
    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
    await spaceDocRef.set(cOn(space, URL_PATHS.SPACE));

    const guardian = {
      uid: owner,
      parentId: space.uid,
      parentCol: COL.SPACE,
    };
    await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner).set(cOn(guardian));
    await spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner).set(cOn(guardian));

    return {
      ...space,
      guardians: { [owner]: guardian },
      members: { [owner]: guardian },
    };
  });
