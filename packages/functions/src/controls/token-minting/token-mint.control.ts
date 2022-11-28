import { TransactionHelper } from '@iota/iota.js-next';
import {
  COL,
  Member,
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
import { CommonJoi } from '../../services/joi/common';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../services/wallet/wallet';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { networks } from '../../utils/config.utils';
import { cOn, dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { createAliasOutput } from '../../utils/token-minting-utils/alias.utils';
import {
  createFoundryOutput,
  getVaultAndGuardianOutput,
  tokenToFoundryMetadata,
} from '../../utils/token-minting-utils/foundry.utils';
import { getTotalDistributedTokenCount } from '../../utils/token-minting-utils/member.utils';
import { assertIsGuardian, assertTokenApproved, assertTokenStatus } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';
import { AVAILABLE_NETWORKS } from '../common';

export const mintTokenOrder = functions
  .runWith({
    minInstances: scale(WEN_FUNC.mintTokenOrder),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.mintTokenOrder, context);
    const params = await decodeAuth(req, WEN_FUNC.mintTokenOrder);
    const owner = params.address.toLowerCase();
    const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));
    const schema = Joi.object({
      token: CommonJoi.uid(),
      network: Joi.string()
        .equal(...availaibleNetworks)
        .required(),
    });
    await assertValidationAsync(schema, params.body);

    return await admin.firestore().runTransaction(async (transaction) => {
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
      const token = <Token | undefined>(await transaction.get(tokenDocRef)).data();
      if (!token) {
        throw throwInvalidArgument(WenError.invalid_params);
      }

      assertTokenApproved(token, true);

      if (
        token.coolDownEnd &&
        dayjs().subtract(1, 'm').isBefore(dayjs(token.coolDownEnd.toDate()))
      ) {
        throw throwInvalidArgument(WenError.can_not_mint_in_pub_sale);
      }

      assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED]);

      await assertIsGuardian(token.space, owner);
      const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data();
      assertMemberHasValidAddress(member, params.body.network);

      const wallet = (await WalletService.newWallet(params.body.network)) as SmrWallet;
      const targetAddress = await wallet.getNewIotaAddressDetails();

      const totalDistributed = await getTotalDistributedTokenCount(token);
      const storageDeposits = await getStorageDepositForMinting(
        token,
        totalDistributed,
        targetAddress,
        wallet,
      );

      const order = <Transaction>{
        type: TransactionType.ORDER,
        uid: getRandomEthAddress(),
        member: owner,
        space: token!.space,
        network: params.body.network,
        payload: {
          type: TransactionOrderType.MINT_TOKEN,
          amount: Object.values(storageDeposits).reduce((acc, act) => acc + act, 0),
          targetAddress: targetAddress.bech32,
          expiresOn: dateToTimestamp(
            dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
          ),
          validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
          reconciled: false,
          void: false,
          token: params.body.token,
          ...storageDeposits,
          tokensInVault: totalDistributed,
        },
      };
      transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`), cOn(order));
      return order;
    });
  });

const getStorageDepositForMinting = async (
  token: Token,
  totalDistributed: number,
  address: AddressDetails,
  wallet: SmrWallet,
) => {
  const aliasOutput = createAliasOutput(address, wallet.info);
  const metadata = await tokenToFoundryMetadata(token);
  const foundryOutput = createFoundryOutput(
    token.totalSupply,
    aliasOutput,
    JSON.stringify(metadata),
    wallet.info,
  );
  const tokenId = TransactionHelper.constructTokenId(
    aliasOutput.aliasId,
    foundryOutput.serialNumber,
    foundryOutput.tokenScheme.type,
  );
  const { vaultOutput, guardianOutput } = await getVaultAndGuardianOutput(
    tokenId,
    token.totalSupply,
    totalDistributed,
    address.bech32,
    address.bech32,
    wallet.info,
  );
  const aliasStorageDeposit = TransactionHelper.getStorageDeposit(
    aliasOutput,
    wallet.info.protocol.rentStructure,
  );
  const foundryStorageDeposit = TransactionHelper.getStorageDeposit(
    foundryOutput,
    wallet.info.protocol.rentStructure,
  );
  return {
    aliasStorageDeposit,
    foundryStorageDeposit,
    vaultStorageDeposit: Number(vaultOutput?.amount || 0),
    guardianStorageDeposit: Number(guardianOutput?.amount || 0),
  };
};
