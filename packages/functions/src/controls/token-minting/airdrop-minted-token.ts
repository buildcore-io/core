/* eslint-disable @typescript-eslint/no-explicit-any */
import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  StakeType,
  TRANSACTION_AUTO_EXPIRY_MS,
  Token,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { chunk } from 'lodash';
import { soonDb } from '../../firebase/firestore/soondb';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian, assertTokenApproved, assertTokenStatus } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { TokenDropRequest } from '../token/token.airdrop';

export const airdropMintedTokenControl = async (owner: string, params: Record<string, unknown>) => {
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.token}`);
  await soonDb().runTransaction(async (transaction) => {
    const token = await transaction.get<Token>(tokenDocRef);

    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }
    await assertIsGuardian(token.space, owner);
    assertTokenStatus(token, [TokenStatus.MINTED]);
    assertTokenApproved(token);
  });

  const token = (await tokenDocRef.get<Token>())!;
  const drops = params.drops as TokenDropRequest[];

  const totalDropped = drops.reduce((acc, act) => acc + act.count, 0);
  const wallet = (await WalletService.newWallet(token.mintingData?.network)) as SmrWallet;
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const nativeToken = {
    amount: HexHelper.fromBigInt256(bigInt(totalDropped)),
    id: token.mintingData?.tokenId!,
  };
  const output = packBasicOutput(targetAddress.bech32, 0, [nativeToken], wallet.info);
  const order = <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: token.space,
    network: token.mintingData?.network,
    payload: {
      type: TransactionOrderType.AIRDROP_MINTED_TOKEN,
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
    createdBy: owner,
    uid: getRandomEthAddress(),
    member: drop.recipient.toLowerCase(),
    token: token.uid,
    vestingAt: dateToTimestamp(drop.vestingAt),
    count: drop.count,
    status: TokenDropStatus.DEPOSIT_NEEDED,
    orderId: order.uid,
    sourceAddress: targetAddress.bech32,
    stakeType: drop.stakeType || StakeType.DYNAMIC,
  }));

  const chunks = chunk(airdrops, 500);
  for (const chunk of chunks) {
    const batch = soonDb().batch();
    chunk.forEach((airdrop) => {
      const docRef = soonDb().doc(`${COL.AIRDROP}/${airdrop.uid}`);
      batch.create(docRef, airdrop);
    });
    await batch.commit();
  }
  await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  return order;
};
