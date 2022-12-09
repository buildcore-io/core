import {
  COL,
  DEFAULT_NETWORK,
  MAX_AIRDROP,
  MAX_TOTAL_TOKEN_SUPPLY,
  Space,
  StakeType,
  Token,
  TokenDrop,
  TokenDropStatus,
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
import { chunk, isEmpty } from 'lodash';
import admin, { inc } from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { WalletService } from '../services/wallet/wallet';
import { getAddress } from '../utils/address.utils';
import { generateRandomAmount } from '../utils/common.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import {
  assertIsGuardian,
  assertTokenApproved,
  assertTokenStatus,
  getUnclaimedDrops,
} from '../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

export interface TokenDropRequest {
  readonly vestingAt: Date;
  readonly count: number;
  readonly recipient: string;
  readonly stakeType?: StakeType;
}

export const airdropTokenSchema = {
  token: CommonJoi.uid(),
  drops: Joi.array()
    .required()
    .items(
      Joi.object().keys({
        vestingAt: Joi.date().required(),
        count: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
        recipient: CommonJoi.uid().required(),
        stakeType: Joi.string().equal(StakeType.STATIC, StakeType.DYNAMIC).optional(),
      }),
    )
    .min(1)
    .max(MAX_AIRDROP),
};

const hasAvailableTokenToAirdrop = (token: Token, count: number) => {
  const publicPercentage = token.allocations.find((a) => a.isPublicSale)?.percentage || 0;
  const totalPublicSupply = Math.floor(token.totalSupply * (publicPercentage / 100));
  return token.totalSupply - totalPublicSupply - token.totalAirdropped >= count;
};

export const airdropToken = functions
  .runWith({ minInstances: scale(WEN_FUNC.airdropToken) })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.airdropToken, context);
    const params = await decodeAuth(req, WEN_FUNC.airdropToken);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(airdropTokenSchema);
    await assertValidationAsync(schema, params.body);

    const chunks = chunk(params.body.drops as TokenDropRequest[], 450);
    for (const chunk of chunks) {
      await admin.firestore().runTransaction(async (transaction) => {
        const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
        const token = <Token | undefined>(await transaction.get(tokenDocRef)).data();

        if (!token) {
          throw throwInvalidArgument(WenError.token_does_not_exist);
        }

        assertTokenApproved(token);
        assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED]);

        await assertIsGuardian(token.space, owner);

        const totalDropped = chunk.reduce((sum, { count }) => sum + count, 0);
        if (!hasAvailableTokenToAirdrop(token, totalDropped)) {
          throw throwInvalidArgument(WenError.no_tokens_available_for_airdrop);
        }

        transaction.update(tokenDocRef, uOn({ totalAirdropped: inc(totalDropped) }));

        for (const drop of chunk) {
          const airdrop: TokenDrop = {
            createdBy: owner,
            uid: getRandomEthAddress(),
            member: drop.recipient,
            token: token.uid,
            vestingAt: dateToTimestamp(drop.vestingAt),
            count: drop.count,
            status: TokenDropStatus.UNCLAIMED,
          };
          const docRef = admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`);
          transaction.create(docRef, cOn(airdrop));
        }
      });
    }
  });

export const claimAirdroppedToken = functions
  .runWith({ minInstances: scale(WEN_FUNC.claimAirdroppedToken) })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.claimAirdroppedToken, context);
    const params = await decodeAuth(req, WEN_FUNC.claimAirdroppedToken);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({ token: Joi.string().required() });
    await assertValidationAsync(schema, params.body);

    const token = <Token | undefined>(
      (await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data()
    );
    if (!token) {
      throw throwInvalidArgument(WenError.invalid_params);
    }

    assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED]);

    const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data();

    const tranId = getRandomEthAddress();
    const orderDocRef = admin.firestore().collection(COL.TRANSACTION).doc(tranId);

    const wallet = await WalletService.newWallet();
    const targetAddress = await wallet.getNewIotaAddressDetails();

    await admin.firestore().runTransaction(async (transaction) => {
      const claimableDrops = await getUnclaimedDrops(params.body.token, owner);
      if (isEmpty(claimableDrops)) {
        throw throwInvalidArgument(WenError.no_airdrop_to_claim);
      }
      const quantity = claimableDrops.reduce((sum, act) => sum + act.count, 0);

      const order = <Transaction>{
        type: TransactionType.ORDER,
        uid: tranId,
        member: owner,
        space: token.space,
        network: DEFAULT_NETWORK,
        payload: {
          type: TransactionOrderType.TOKEN_AIRDROP,
          amount: generateRandomAmount(),
          targetAddress: targetAddress.bech32,
          beneficiary: 'space',
          beneficiaryUid: token.space,
          beneficiaryAddress: getAddress(space, DEFAULT_NETWORK),
          expiresOn: dateToTimestamp(
            dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
          ),
          validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
          reconciled: false,
          void: false,
          token: token.uid,
          quantity,
        },
      };
      transaction.create(orderDocRef, cOn(order));
    });

    return <Transaction>(await orderDocRef.get()).data();
  });
