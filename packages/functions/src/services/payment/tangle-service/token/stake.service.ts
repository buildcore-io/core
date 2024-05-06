import { database } from '@buildcore/database';
import {
  COL,
  StakeType,
  TRANSACTION_AUTO_EXPIRY_MS,
  TangleResponse,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { packBasicOutput } from '../../../../utils/basic-output.utils';
import { dateToTimestamp, serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getTokenBySymbol } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { depositStakeSchemaObject } from './TokenStakeTangleRequestSchema';

export class TangleStakeService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    owner,
    request,
    tran,
    tranEntry,
    project,
    payment,
  }: HandlerParams) => {
    const params = await assertValidationAsync(depositStakeSchemaObject, request);

    const order = await createStakeOrder(
      project,
      owner,
      params.symbol,
      params.weeks,
      params.type as StakeType,
      params.customMetadata,
    );
    set(order, 'payload.amount', tranEntry.amount);

    this.transactionService.push({
      ref: database().doc(COL.TRANSACTION, order.uid),
      data: order,
      action: Action.C,
    });

    this.transactionService.createUnlockTransaction(
      payment,
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );

    return {};
  };
}

export const createStakeOrder = async (
  project: string,
  owner: string,
  symbol: string,
  weeks: number,
  type: StakeType,
  customMetadata?: Record<string, unknown>,
): Promise<Transaction> => {
  const token = await getTokenBySymbol(symbol);
  if (!token?.mintingData?.tokenId) {
    throw invalidArgument(WenError.token_not_minted);
  }

  if (!token.approved || token.rejected) {
    throw invalidArgument(WenError.token_not_approved);
  }

  const network = token.mintingData?.network!;
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const nativeTokens = [
    {
      id: token.mintingData.tokenId,
      amount: BigInt(Number.MAX_SAFE_INTEGER),
    },
  ];
  const output = await packBasicOutput(wallet, targetAddress.bech32, 0, {
    nativeTokens,
    customMetadata,
    vestingAt: dateToTimestamp(dayjs().add(weeks, 'weeks').toDate()),
  });
  return {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: token.space,
    createdOn: serverTime(),
    network,
    payload: {
      type: TransactionPayloadType.STAKE,
      amount: Number(output.amount),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      validationType: TransactionValidationType.ADDRESS,
      reconciled: false,
      void: false,
      weeks,
      token: token.uid,
      tokenId: token.mintingData?.tokenId,
      stakeType: type,
      customMetadata: (customMetadata || {}) as { [key: string]: string },
    },
  };
};
