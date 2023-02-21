import {
  AddressTypes,
  ALIAS_ADDRESS_TYPE,
  ED25519_ADDRESS_TYPE,
  INftAddress,
  NFT_ADDRESS_TYPE,
} from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import {
  Award,
  AwardBadgeType,
  COL,
  KEY_NAME_TANGLE,
  MediaStatus,
  Space,
  Token,
  Transaction,
  TransactionAwardType,
  TransactionCreditType,
  TransactionType,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { set } from 'lodash';
import admin, { inc } from '../../../admin.config';
import { packBasicOutput } from '../../../utils/basic-output.utils';
import { PLACEHOLDER_CID } from '../../../utils/car.utils';
import { createNftOutput } from '../../../utils/collection-minting-utils/nft.utils';
import { getContentType } from '../../../utils/storage.utils';
import { createAliasOutput } from '../../../utils/token-minting-utils/alias.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { SmrWallet } from '../../wallet/SmrWalletService';
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

    if (order.payload.legacyAwardFundRequestId) {
      const legacyAwardFundRequesDocRef = admin
        .firestore()
        .doc(`${COL.TRANSACTION}/${order.payload.legacyAwardFundRequestId}`);
      this.transactionService.updates.push({
        ref: legacyAwardFundRequesDocRef,
        data: { 'payload.legacyAwardsBeeingFunded': inc(-1) },
        action: 'update',
      });
    }
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
  participatedOn = dayjs(),
  edition = 0,
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

export const getAwardgStorageDeposits = async (award: Award, token: Token, wallet: SmrWallet) => {
  const address = await wallet.getNewIotaAddressDetails();

  const aliasOutput = createAliasOutput(address, wallet.info);

  const collectioIssuerAddress: AddressTypes = {
    type: ALIAS_ADDRESS_TYPE,
    aliasId: aliasOutput.aliasId,
  };

  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${award.space}`);
  const space = <Space>(await spaceDocRef.get()).data();

  const collectionMetadata = await awardToCollectionMetadata(award, space);
  const collectionOutput = createNftOutput(
    collectioIssuerAddress,
    collectioIssuerAddress,
    JSON.stringify(collectionMetadata),
    wallet.info,
  );

  const nttMetadata = await awardBadgeToNttMetadata(
    award,
    collectionOutput.nftId,
    getRandomEthAddress(),
    dayjs(),
    0,
  );
  const issuerAddress: INftAddress = { type: NFT_ADDRESS_TYPE, nftId: collectionOutput.nftId };
  const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex };
  const ntt = createNftOutput(
    ownerAddress,
    issuerAddress,
    JSON.stringify(nttMetadata),
    wallet.info,
    dayjs().add(100, 'y'),
  );

  const storageDeposit = {
    aliasStorageDeposit: Number(aliasOutput.amount),
    collectionStorageDeposit: Number(collectionOutput.amount),
    nttStorageDeposit: Number(ntt.amount) * award.badge.total,
    nativeTokenStorageDeposit: 0,
  };

  if (award.badge.type === AwardBadgeType.NATIVE) {
    const nativeTokenAmount = award.badge.total * award.badge.tokenReward;
    const nativeToken = {
      id: token?.mintingData?.tokenId!,
      amount: HexHelper.fromBigInt256(bigInt(nativeTokenAmount)),
    };
    const nativeTokenOutput = packBasicOutput(address.bech32, 0, [nativeToken], wallet.info);
    storageDeposit.nativeTokenStorageDeposit = Number(nativeTokenOutput.amount);
  }

  return storageDeposit;
};
