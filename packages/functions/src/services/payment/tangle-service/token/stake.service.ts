import { build5Db } from '@build-5/database';
import {
  COL,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  StakeType,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { packBasicOutput } from '../../../../utils/basic-output.utils';
import { dateToTimestamp, serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getTokenBySymbol } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { SmrWallet } from '../../../wallet/SmrWalletService';
import { WalletService } from '../../../wallet/wallet';
import { TransactionService } from '../../transaction-service';
import { depositStakeSchemaObject } from './TokenStakeTangleRequestSchema';

export class TangleStakeService {
  constructor(readonly transactionService: TransactionService) {}

  public handleStaking = async (
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
  ) => {
    const params = await assertValidationAsync(depositStakeSchemaObject, request);

    const order = await createStakeOrder(
      owner,
      params.symbol,
      params.weeks,
      params.type as StakeType,
      params.customMetadata,
    );
    set(order, 'payload.amount', tranEntry.amount);

    this.transactionService.push({
      ref: build5Db().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });

    this.transactionService.createUnlockTransaction(
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );
    return;
  };
}

export const createStakeOrder = async (
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
  const wallet = (await WalletService.newWallet(network)) as SmrWallet;
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const nativeTokens = [
    {
      id: token.mintingData.tokenId,
      amount: HexHelper.fromBigInt256(bigInt(Number.MAX_SAFE_INTEGER)),
    },
  ];
  const output = packBasicOutput(
    targetAddress.bech32,
    0,
    nativeTokens,
    wallet.info,
    '',
    dateToTimestamp(dayjs().add(weeks, 'weeks').toDate()),
    undefined,
    customMetadata,
  );
  return {
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
