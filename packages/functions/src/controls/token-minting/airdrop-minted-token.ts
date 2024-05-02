/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  COL,
  CreateAirdropsRequest,
  StakeType,
  TRANSACTION_AUTO_EXPIRY_MS,
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
import { chunk } from 'lodash';
import { WalletService } from '../../services/wallet/wallet.service';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import {
  assertIsTokenGuardian,
  assertTokenApproved,
  assertTokenStatus,
} from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const airdropMintedTokenControl = async ({
  project,
  owner,
  params,
}: Context<CreateAirdropsRequest>) => {
  await database().runTransaction(async (transaction) => {
    const tokenDocRef = database().doc(COL.TOKEN, params.token);
    const token = await transaction.get(tokenDocRef);

    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }
    await assertIsTokenGuardian(token, owner);
    assertTokenStatus(token, [TokenStatus.MINTED]);
    assertTokenApproved(token);
  });

  const tokenDocRef = database().doc(COL.TOKEN, params.token);
  const token = (await tokenDocRef.get())!;
  const drops = params.drops;

  const totalDropped = drops.reduce((acc, act) => acc + act.count, 0);
  const wallet = await WalletService.newWallet(token.mintingData?.network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const nativeToken = {
    amount: BigInt(totalDropped),
    id: token.mintingData?.tokenId!,
  };
  const output = await packBasicOutput(wallet, targetAddress.bech32, 0, {
    nativeTokens: [nativeToken],
  });
  const order: Transaction = {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: token.space,
    network: token.mintingData?.network!,
    payload: {
      type: TransactionPayloadType.AIRDROP_MINTED_TOKEN,
      amount: Number(output.amount),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      validationType: TransactionValidationType.ADDRESS,
      reconciled: false,
      void: false,
      token: token.uid,
      unclaimedAirdrops: drops.length,
      totalAirdropCount: drops.reduce((acc, act) => acc + act.count, 0),
    },
  };

  const airdrops: TokenDrop[] = drops.map((drop) => ({
    project,
    createdBy: owner,
    uid: getRandomEthAddress(),
    member: drop.recipient.toLowerCase(),
    token: token.uid,
    vestingAt: dateToTimestamp(drop.vestingAt),
    count: drop.count,
    status: TokenDropStatus.DEPOSIT_NEEDED,
    orderId: order.uid,
    sourceAddress: targetAddress.bech32,
    stakeType: (drop.stakeType as StakeType) || StakeType.DYNAMIC,
  }));

  const chunks = chunk(airdrops, 500);
  for (const chunk of chunks) {
    const batch = database().batch();
    for (const airdrop of chunk) {
      const docRef = database().doc(COL.AIRDROP, airdrop.uid);
      batch.create(docRef, airdrop);
    }
    await batch.commit();
  }
  await database().doc(COL.TRANSACTION, order.uid).create(order);
  return order;
};
