import { database } from '@buildcore/database';
import {
  COL,
  Member,
  SUB_COL,
  TRANSACTION_AUTO_EXPIRY_MS,
  TangleResponse,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { assertMemberHasValidAddress } from '../../../../utils/address.utils';
import { dateToTimestamp, serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { dropToOutput } from '../../../../utils/token-minting-utils/member.utils';
import { getTokenBySymbol, getUnclaimedDrops } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { tokenClaimSchema } from './TokenClaimTangleRequestSchema';

export class TangleTokenClaimService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ project, owner, request }: HandlerParams) => {
    const params = await assertValidationAsync(tokenClaimSchema, request);
    const order = await createMintedTokenAirdropClaimOrder(project, owner, params.symbol);
    this.transactionService.push({
      ref: database().doc(COL.TRANSACTION, order.uid),
      data: order,
      action: Action.C,
    });
    return { amount: order.payload.amount!, address: order.payload.targetAddress! };
  };
}

export const createMintedTokenAirdropClaimOrder = async (
  project: string,
  owner: string,
  symbol: string,
): Promise<Transaction> => {
  const token = await getTokenBySymbol(symbol);
  if (!token) {
    throw invalidArgument(WenError.token_does_not_exist);
  }

  if (![TokenStatus.MINTED, TokenStatus.BASE].includes(token.status)) {
    throw invalidArgument(WenError.token_in_invalid_status);
  }

  const member = <Member>await database().doc(COL.MEMBER, owner).get();
  assertMemberHasValidAddress(member, token.mintingData?.network!);

  const drops = await getClaimableDrops(token.uid, owner);
  if (isEmpty(drops)) {
    throw invalidArgument(WenError.no_tokens_to_claim);
  }

  const wallet = await WalletService.newWallet(token.mintingData?.network!);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  let storageDeposit = 0;
  for (const drop of drops) {
    const output = await dropToOutput(wallet, token, drop, targetAddress.bech32);
    storageDeposit += Number(output.amount);
  }

  return {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: token!.space,
    network: token.mintingData?.network!,
    payload: {
      type: TransactionPayloadType.CLAIM_MINTED_TOKEN,
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
  const distributionDocRef = database().doc(COL.TOKEN, token, SUB_COL.DISTRIBUTION, member);
  const distribution = await distributionDocRef.get();
  if (distribution?.mintedClaimedOn || !distribution?.tokenOwned) {
    return airdops;
  }
  const drop: TokenDrop = {
    project: '',
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
