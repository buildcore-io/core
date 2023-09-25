import { build5Db } from '@build-5/database';
import {
  BaseTangleResponse,
  COL,
  Member,
  SUB_COL,
  TRANSACTION_AUTO_EXPIRY_MS,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { assertMemberHasValidAddress } from '../../../../utils/address.utils';
import { getProjects } from '../../../../utils/common.utils';
import { dateToTimestamp, serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { dropToOutput } from '../../../../utils/token-minting-utils/member.utils';
import { getTokenBySymbol, getUnclaimedDrops } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { SmrWallet } from '../../../wallet/SmrWalletService';
import { WalletService } from '../../../wallet/wallet';
import { BaseService, HandlerParams } from '../../base';
import { tokenClaimSchema } from './TokenClaimTangleRequestSchema';

export class TangleTokenClaimService extends BaseService {
  public handleRequest = async ({
    project,
    owner,
    request,
  }: HandlerParams): Promise<BaseTangleResponse> => {
    const params = await assertValidationAsync(tokenClaimSchema, request);
    const order = await createMintedTokenAirdropCalimOrder(project, owner, params.symbol);
    this.transactionService.push({
      ref: build5Db().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });
    return { amount: order.payload.amount!, address: order.payload.targetAddress! };
  };
}

export const createMintedTokenAirdropCalimOrder = async (
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

  const member = <Member>await build5Db().doc(`${COL.MEMBER}/${owner}`).get();
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

  return {
    project,
    projects: getProjects([], project),
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
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token}`);
  const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member);
  const distribution = await distributionDocRef.get<TokenDistribution>();
  if (distribution?.mintedClaimedOn || !distribution?.tokenOwned) {
    return airdops;
  }
  const drop: TokenDrop = {
    project: '',
    projects: {},
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
