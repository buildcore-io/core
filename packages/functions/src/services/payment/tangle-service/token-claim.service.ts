import {
  COL,
  Member,
  SUB_COL,
  TRANSACTION_AUTO_EXPIRY_MS,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import { soonDb } from '../../../firebase/firestore/soondb';
import { assertMemberHasValidAddress } from '../../../utils/address.utils';
import { dateToTimestamp, serverTime } from '../../../utils/dateTime.utils';
import { invalidArgument } from '../../../utils/error.utils';
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
    this.transactionService.push({
      ref: soonDb().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });

    return { amount: order.payload.amount, address: order.payload.targetAddress };
  };
}

export const createMintedTokenAirdropCalimOrder = async (owner: string, symbol: string) => {
  const token = await getTokenBySymbol(symbol);
  if (!token) {
    throw invalidArgument(WenError.token_does_not_exist);
  }

  if (![TokenStatus.MINTED, TokenStatus.BASE].includes(token.status)) {
    throw invalidArgument(WenError.token_in_invalid_status);
  }

  const member = <Member>await soonDb().doc(`${COL.MEMBER}/${owner}`).get();
  assertMemberHasValidAddress(member, token.mintingData?.network!);

  const drops = await getClaimableDrops(token.uid, owner);
  if (isEmpty(drops)) {
    throw invalidArgument(WenError.no_tokens_to_claim);
  }

  const wallet = (await WalletService.newWallet(token.mintingData?.network!)) as SmrWallet;
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const storageDeposit = drops.reduce((acc, drop) => {
    const output = dropToOutput(token, drop, targetAddress.bech32, wallet.info);
    return acc + Number(output.amount);
  }, 0);

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
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
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
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${token}`);
  const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member);
  const distribution = await distributionDocRef.get<TokenDistribution>();
  if (distribution?.mintedClaimedOn || !distribution?.tokenOwned) {
    return airdops;
  }
  const drop: TokenDrop = {
    uid: getRandomEthAddress(),
    member,
    token,
    createdOn: serverTime(),
    vestingAt: serverTime(),
    count: distribution?.tokenOwned,
    status: TokenDropStatus.UNCLAIMED,
  };
  return [drop, ...airdops];
};
