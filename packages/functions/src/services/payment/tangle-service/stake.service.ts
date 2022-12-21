import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  StakeType,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import Joi from 'joi';
import { set } from 'lodash';
import admin from '../../../admin.config';
import { depositStakeSchema } from '../../../controls/stake.control';
import { packBasicOutput } from '../../../utils/basic-output.utils';
import { dateToTimestamp, serverTime } from '../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../utils/error.utils';
import { assertValidationAsync } from '../../../utils/schema.utils';
import { getTokenBySymbol } from '../../../utils/token.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { WalletService } from '../../wallet/wallet';
import { TransactionService } from '../transaction-service';

export class TangleStakeService {
  constructor(readonly transactionService: TransactionService) {}

  public handleStaking = async (
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
  ) => {
    const params = {
      symbol: request.symbol,
      weeks: request.weeks,
      type: request.type,
      customMetadata: request.customMetadata,
    };
    const schema = Joi.object(depositStakeSchema);
    await assertValidationAsync(schema, params);

    const order = await createStakeOrder(
      owner,
      params.symbol as string,
      params.weeks as number,
      params.type as StakeType,
      params.customMetadata as Record<string, unknown>,
    );
    set(order, 'payload.amount', tranEntry.amount);

    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });

    this.transactionService.createUnlockTransaction(
      dayjs().add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
      order,
      tran,
      tranEntry,
      TransactionUnlockType.TANGLE_TRANSFER,
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
) => {
  const token = await getTokenBySymbol(symbol);
  if (!token?.mintingData?.tokenId) {
    throw throwInvalidArgument(WenError.token_not_minted);
  }

  if (!token.approved || token.rejected) {
    throw throwInvalidArgument(WenError.token_not_approved);
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
  return <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: token.space,
    createdOn: serverTime(),
    network,
    payload: {
      type: TransactionOrderType.STAKE,
      amount: Number(output.amount),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(
        dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
      ),
      validationType: TransactionValidationType.ADDRESS,
      reconciled: false,
      void: false,
      weeks,
      token: token.uid,
      tokenId: token.mintingData?.tokenId,
      stakeType: type,
      customMetadata: customMetadata || {},
    },
  };
};
