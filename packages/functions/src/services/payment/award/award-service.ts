import {
  Award,
  AwardBadgeType,
  COL,
  KEY_NAME_TANGLE,
  MediaStatus,
  Space,
  Transaction,
  TransactionAwardType,
  TransactionCreditType,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import admin from '../../../admin.config';
import { PLACEHOLDER_CID } from '../../../utils/car.utils';
import { getContentType } from '../../../utils/storage.utils';
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

export const awardToCollectionMetadata = async (award: Award, space: Space) => ({
  standard: 'IRC27',
  version: 'v1.0',
  type: await getContentType(award.badge.image),
  uri: space.ipfsMedia ? `ipfs://${space.ipfsMedia}` : '',
  name: award.name,
  description: award.description || '',
  issuerName: KEY_NAME_TANGLE,
  soonaverseId: award.uid,
});

export const awardBadgeToNttMetadata = async (
  award: Award,
  collectionId: string,
  badgeTransactionId: string,
  participatedOn: dayjs.Dayjs,
  edition: number,
) => {
  const metadata = {
    standard: 'IRC27',
    version: 'v1.0',

    type: await getContentType(award.badge.image),

    uri: award.badge.ipfsMedia ? `ipfs://${award.badge.ipfsMedia}` : '',
    name: award.badge.name,
    description: award.badge.description,
    issuerName: KEY_NAME_TANGLE,
    collectionId,
    collectionName: award.name || '',

    soonaverseId: badgeTransactionId,

    attributes: [
      { trait_type: 'award', value: award.uid },
      { trait_type: 'tokenReward', value: award.badge.tokenReward },
      { trait_type: 'participated_on', value: participatedOn.unix() },
      { trait_type: 'edition', value: edition },
      { trait_type: 'size', value: award.badge.total },
    ],
  };
  if (award.badge.type === AwardBadgeType.NATIVE) {
    metadata.attributes.push({ trait_type: 'tokenId', value: award.badge.tokenId! });
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
