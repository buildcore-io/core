import {
  COL,
  Member,
  SUB_COL,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import admin from '../../../admin.config';
import { assertMemberHasValidAddress } from '../../../utils/address.utils';
import { dateToTimestamp, serverTime } from '../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../utils/error.utils';
import { assertValidationAsync } from '../../../utils/schema.utils';
import { dropToOutput } from '../../../utils/token-minting-utils/member.utils';
import { getTokenBySymbol, getUnclaimedDrops } from '../../../utils/token.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { CommonJoi } from '../../joi/common';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { WalletService } from '../../wallet/wallet';
import { TransactionService } from '../transaction-service';

export class TangleTokenClaimService {
  constructor(readonly transactionService: TransactionService) {}

  public handleMintedTokenAirdropRequest = async (
    owner: string,
    request: Record<string, unknown>,
  ) => {
    const params = { symbol: request.symbol };
    await assertValidationAsync(Joi.object({ symbol: CommonJoi.tokenSymbol() }), params);

    const order = await createMintedTokenAirdropCalimOrder(owner, params.symbol as string);
    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });

    return { amount: order.payload.amount, address: order.payload.targetAddress };
  };
}

export const createMintedTokenAirdropCalimOrder = async (owner: string, symbol: string) => {
  const token = await getTokenBySymbol(symbol);
  if (!token) {
    throw throwInvalidArgument(WenError.invalid_params);
  }

  if (token.status !== TokenStatus.MINTED) {
    throw throwInvalidArgument(WenError.token_not_minted);
  }

  const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data();
  assertMemberHasValidAddress(member, token.mintingData?.network!);

  console.log('ASDSAD', owner);

  const drops = await getClaimableDrops(token.uid, owner);
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

  return <Transaction>{
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
      token: token.uid,
    },
    linkedTransactions: [],
  };
};

const getClaimableDrops = async (token: string, member: string) => {
  const airdops = await getUnclaimedDrops(token, member);
  const distributionDocRef = admin
    .firestore()
    .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`);
  const distribution = <TokenDistribution | undefined>(await distributionDocRef.get()).data();
  if (distribution?.mintedClaimedOn || !distribution?.tokenOwned) {
    return airdops;
  }
  const drop: TokenDrop = {
    uid: getRandomEthAddress(),
    member,
    token,
    createdOn: dateToTimestamp(dayjs()),
    vestingAt: dateToTimestamp(dayjs()),
    count: distribution?.tokenOwned,
    status: TokenDropStatus.UNCLAIMED,
  };
  return [drop, ...airdops];
};
