import {
  Award,
  AwardBadgeType,
  COL,
  MediaStatus,
  Transaction,
  TransactionAwardType,
  TransactionCreditType,
  TransactionType,
} from '@soonaverse/interfaces';
import { set } from 'lodash';
import admin from '../../../admin.config';
import { PLACEHOLDER_CID } from '../../../utils/car.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class AwardService {
  constructor(readonly transactionService: TransactionService) {}

  public handleAwardFundingOrder = async (order: Transaction, match: TransactionMatch) => {
    const payment = await this.transactionService.createPayment(order, match);

    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${order.payload.award}`);
    const award = <Award>(await this.transactionService.transaction.get(awardDocRef)).data();

    if (award.funded) {
      await this.transactionService.createCredit(
        TransactionCreditType.DATA_NO_LONGER_VALID,
        payment,
        match,
      );
      return;
    }

    if (award.badge.type === AwardBadgeType.NATIVE) {
      const nativeTokens = match.to.nativeTokens || [];
      const nativeToken = nativeTokens.find((nt) => nt.id === award.badge.tokenId);
      const nativeTokensReceived = Number(nativeToken?.amount || 0);
      const nativeTokensExpected = award.badge.total * award.badge.tokenReward;
      if (nativeTokens.length !== 1 || nativeTokensReceived !== nativeTokensExpected) {
        await this.transactionService.createCredit(
          TransactionCreditType.INVALID_AMOUNT,
          payment,
          match,
        );
        return;
      }
    }

    this.transactionService.markAsReconciled(order, match.msgId);

    this.transactionService.updates.push({
      ref: awardDocRef,
      data: {
        funded: true,
        address: order.payload.targetAddress,
        fundedBy: order.member,
        mediaStatus: MediaStatus.PENDING_UPLOAD,
      },
      action: 'update',
    });

    const mintAliasOrder = <Transaction>{
      type: TransactionType.AWARD,
      uid: getRandomEthAddress(),
      member: order.member,
      space: order.space,
      network: order.network,
      payload: {
        type: TransactionAwardType.MINT_ALIAS,
        amount: award.aliasStorageDeposit,
        sourceAddress: order.payload.targetAddress,
        targetAddress: order.payload.targetAddress,
        award: award.uid,
      },
    };
    const mintAliasTranDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${mintAliasOrder.uid}`);
    this.transactionService.updates.push({
      ref: mintAliasTranDocRef,
      data: mintAliasOrder,
      action: 'set',
    });
  };
}

export const awardToCollectionMetadata = (award: Award) => ({
  award: award.uid,
  space: award.space,
  name: award.name,
  description: award.description,
  uri: 'ipfs://' + (award.badge.ipfsMedia || PLACEHOLDER_CID),
});

export const awardBadgeToNttMetadata = (award: Award) => {
  const metadata = {
    award: award.uid,
    space: award.space,
    name: award.badge.name,
    description: award.badge.description,
    uri: 'ipfs://' + (award.badge.ipfsMedia || PLACEHOLDER_CID),
    tokenReward: award.badge.tokenReward,
  };
  if (award.badge.type === AwardBadgeType.NATIVE) {
    set(metadata, 'tokenId', award.badge.tokenId);
  }
  return metadata;
};

export const awardToIpfsMetadata = (award: Award) => {
  const metadata = {
    award: award.uid,
    space: award.space,
    name: award.name,
    description: award.description,
    badge: {
      name: award.badge.name,
      description: award.badge.description,
      uri: 'ipfs://' + (award.badge.ipfsMedia || PLACEHOLDER_CID),
      tokenReward: award.badge.tokenReward,
    },
  };
  if (award.badge.type === AwardBadgeType.NATIVE) {
    set(metadata, 'tokenId', award.badge.tokenId);
  }
  return metadata;
};
