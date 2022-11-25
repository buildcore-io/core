/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  Token,
  TokenStatus,
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
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { cOn, dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsGuardian, assertTokenApproved, assertTokenStatus } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { airdropTokenSchema } from '../token-airdrop.control';

export const airdropMintedToken = functions
  .runWith({ minInstances: scale(WEN_FUNC.airdropMintedToken) })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.airdropToken, context);
    const params = await decodeAuth(req, WEN_FUNC.airdropToken);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(airdropTokenSchema);
    await assertValidationAsync(schema, params.body);

    return await admin.firestore().runTransaction(async (transaction) => {
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
      const token = <Token | undefined>(await transaction.get(tokenDocRef)).data();

      if (!token) {
        throw throwInvalidArgument(WenError.invalid_params);
      }
      await assertIsGuardian(token.space, owner);
      assertTokenStatus(token, [TokenStatus.MINTED]);
      assertTokenApproved(token);

      const totalDropped = params.body.drops.reduce((acc: number, act: any) => acc + act.count, 0);

      const wallet = (await WalletService.newWallet(token.mintingData?.network)) as SmrWallet;
      const targetAddress = await wallet.getNewIotaAddressDetails();
      const output = packBasicOutput(
        targetAddress.bech32,
        0,
        [{ amount: totalDropped, id: token.mintingData?.tokenId! }],
        wallet.info,
      );
      const order = <Transaction>{
        type: TransactionType.ORDER,
        uid: getRandomEthAddress(),
        member: owner,
        space: token.space,
        network: token.mintingData?.network,
        payload: {
          type: TransactionOrderType.AIRDROP_MINTED_TOKEN,
          amount: Number(output.amount),
          targetAddress: targetAddress.bech32,
          expiresOn: dateToTimestamp(
            dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
          ),
          validationType: TransactionValidationType.ADDRESS,
          reconciled: false,
          void: false,
          token: token.uid,
          drops: params.body.drops.map((d: any) => ({
            ...d,
            vestingAt: dateToTimestamp(d.vestingAt),
          })),
        },
      };
      transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`), cOn(order));
      return order;
    });
  });
