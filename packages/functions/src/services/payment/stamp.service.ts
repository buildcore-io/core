import { build5Db, build5Storage } from '@build-5/database';
import {
  COL,
  MediaStatus,
  Space,
  Stamp,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { getProject } from '../../utils/common.utils';
import { getBucket, getStampRoyaltyAddress } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { migrateUriToSotrage, uriToUrl } from '../../utils/media.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { isStorageUrl } from '../joi/common';
import { WalletService } from '../wallet/wallet.service';
import { BaseService, HandlerParams } from './base';
import { getStampDailyCost } from './tangle-service/stamp/StampTangleService';

export class StampService extends BaseService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);

    const stampDocRef = build5Db().doc(`${COL.STAMP}/${order.payload.stamp}`);
    const stamp = <Stamp>await this.transaction.get(stampDocRef);

    const mintAmount = stamp.funded
      ? 0
      : order.payload.aliasOutputAmount! + order.payload.nftOutputAmount!;
    const days = order.payload.days || 0;

    const wallet = await WalletService.newWallet(order.network);
    const royaltyOutput = await packBasicOutput(wallet, order.payload.targetAddress!, 0, {});

    const minRequiredAmount = order.payload.amount! - mintAmount;
    let feeAmount = match.to.amount - mintAmount;

    if (feeAmount < minRequiredAmount) {
      await this.transactionService.createCredit(
        TransactionPayloadType.INVALID_AMOUNT,
        payment,
        match,
      );
      return;
    }

    if (stamp.expired) {
      await this.transactionService.createCredit(
        TransactionPayloadType.INVALID_PAYMENT,
        payment,
        match,
      );
      return;
    }

    const excessAmount = days ? feeAmount - minRequiredAmount : 0;
    if (excessAmount) {
      const output = await packBasicOutput(
        wallet,
        payment.payload.sourceAddress!,
        excessAmount,
        {},
      );
      if (excessAmount >= Number(output.amount)) {
        feeAmount -= excessAmount;
        const credit: Transaction = {
          project: getProject(payment),
          type: TransactionType.CREDIT,
          uid: getRandomEthAddress(),
          space: payment.space,
          member: payment.member,
          network: payment.network,
          payload: {
            type: TransactionPayloadType.STAMP,
            amount: excessAmount,
            sourceAddress: order.payload.targetAddress,
            targetAddress: match.from,
            sourceTransaction: [payment.uid],
            reconciled: true,
            void: false,
          },
        };
        const creditDocRef = build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`);
        this.transactionService.push({
          ref: creditDocRef,
          data: credit,
          action: 'set',
        });
      }
    }

    const expiresAt = dayjs(stamp.expiresAt.toDate()).add(
      this.amountToMilliseconds(stamp, feeAmount),
    );
    const updateData = {
      funded: true,
      mediaStatus: stamp.mediaStatus || MediaStatus.PENDING_UPLOAD,
      expiresAt: dateToTimestamp(expiresAt),
    };
    if (!stamp.funded && !isStorageUrl(stamp.originUri)) {
      const bucket = build5Storage().bucket(getBucket());
      const build5Url = await migrateUriToSotrage(
        COL.STAMP,
        stamp.createdBy!,
        stamp.uid,
        uriToUrl(stamp.originUri),
        bucket,
        true,
      );
      set(updateData, 'build5Url', build5Url);
    }
    this.transactionService.push({ ref: stampDocRef, data: updateData, action: 'update' });

    const aliasId = order.payload.aliasId;

    const royaltyPayment: Transaction = {
      project: getProject(stamp),
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: order.space,
      member: payment.member,
      network: order.network,
      payload: {
        type: TransactionPayloadType.STAMP,
        amount: feeAmount,
        sourceAddress: order.payload.targetAddress,
        targetAddress: getStampRoyaltyAddress(order.network!),
        sourceTransaction: [order.uid],
        stamp: order.payload.stamp,
        reconciled: true,
        royalty: true,
        void: false,
      },
    };
    const royaltyPaymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${royaltyPayment.uid}`);
    this.transactionService.push({
      ref: royaltyPaymentDocRef,
      data: royaltyPayment,
      action: 'set',
    });

    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.push({
      ref: orderDocRef,
      data: {
        'payload.days': build5Db().deleteField(),
        'payload.amount': Number(royaltyOutput.amount),
      },
      action: 'update',
    });

    if (stamp.funded) {
      return;
    }

    if (!aliasId) {
      const mintAlias: Transaction = {
        project: getProject(stamp),
        type: TransactionType.STAMP,
        uid: getRandomEthAddress(),
        space: order.space,
        member: order.member,
        network: order.network,
        payload: {
          type: TransactionPayloadType.MINT_ALIAS,
          amount: order.payload.aliasOutputAmount,
          sourceAddress: order.payload.targetAddress,
          targetAddress: order.payload.targetAddress,
          sourceTransaction: [payment.uid],
          reconciled: false,
          void: false,
          stamp: stamp.uid,
        },
      };
      this.transactionService.push({
        ref: build5Db().doc(`${COL.TRANSACTION}/${mintAlias.uid}`),
        data: mintAlias,
        action: 'set',
      });
      return;
    }

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${stamp.space}`);
    const space = <Space>await spaceDocRef.get();

    const mintNftOrder: Transaction = {
      project: getProject(stamp),
      type: TransactionType.STAMP,
      uid: getRandomEthAddress(),
      space: order.space,
      member: order.member,
      network: order.network,
      payload: {
        type: TransactionPayloadType.MINT_NFT,
        amount: order.payload.nftOutputAmount,
        sourceAddress: order.payload.targetAddress,
        targetAddress: order.payload.targetAddress,
        sourceTransaction: [payment.uid],
        aliasGovAddress: space.alias?.address!,
        aliasId,
        stamp: order.payload.stamp,
      },
    };
    const nftMintOrderDocRef = build5Db().doc(`${COL.TRANSACTION}/${mintNftOrder.uid}`);
    this.transactionService.push({
      ref: nftMintOrderDocRef,
      data: mintNftOrder,
      action: 'set',
    });

    return;
  };

  private amountToMilliseconds = (stamp: Stamp, amount: number) => {
    const dailyCost = getStampDailyCost(stamp);
    return (amount / dailyCost) * 8.64e7;
  };
}
