import {
  COL,
  Member,
  SUB_COL,
  Token,
  TokenDistribution,
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
import { isEmpty } from 'lodash';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { cOn, dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { distributionToDrops, dropToOutput } from '../../utils/token-minting-utils/member.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';

export const claimMintedTokenOrder = functions
  .runWith({
    minInstances: scale(WEN_FUNC.claimMintedTokenOrder),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.claimMintedTokenOrder, context);
    const params = await decodeAuth(req, WEN_FUNC.claimMintedTokenOrder);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({ token: CommonJoi.uid() });
    await assertValidationAsync(schema, params.body);

    return await admin.firestore().runTransaction(async (transaction) => {
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
      const token = <Token | undefined>(await transaction.get(tokenDocRef)).data();
      if (!token) {
        throw throwInvalidArgument(WenError.invalid_params);
      }

      if (token.status !== TokenStatus.MINTED) {
        throw throwInvalidArgument(WenError.token_not_minted);
      }

      const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data();
      assertMemberHasValidAddress(member, token.mintingData?.network!);

      const distribution = <TokenDistribution | undefined>(
        (
          await admin
            .firestore()
            .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member.uid}`)
            .get()
        ).data()
      );
      const drops = distributionToDrops(distribution);
      if (isEmpty(drops)) {
        throw throwInvalidArgument(WenError.no_tokens_to_claim);
      }

      const wallet = (await WalletService.newWallet(token.mintingData?.network!)) as SmrWallet;
      const targetAddress = await wallet.getNewIotaAddressDetails();
      const storageDeposit = drops.reduce(
        (acc, drop) =>
          acc + Number(dropToOutput(token, drop, targetAddress.bech32, wallet.info).amount),
        0,
      );

      const data = <Transaction>{
        type: TransactionType.ORDER,
        uid: getRandomEthAddress(),
        member: owner,
        space: token!.space,
        network: token.mintingData?.network!,
        payload: {
          type: TransactionOrderType.CLAIM_MINTED_TOKEN,
          amount: storageDeposit,
          targetAddress: targetAddress.bech32,
          expiresOn: dateToTimestamp(
            dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
          ),
          validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
          reconciled: false,
          void: false,
          chainReference: null,
          token: params.body.token,
        },
        linkedTransactions: [],
      };
      transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), cOn(data));
      return data;
    });
  });
