import { build5Db } from '@build-5/database';
import {
  Award,
  AwardBadgeType,
  COL,
  KEY_NAME_TANGLE,
  MediaStatus,
  Space,
  Token,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { AliasAddress, Ed25519Address, NftAddress } from '@iota/sdk';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { packBasicOutput } from '../../../utils/basic-output.utils';
import { PLACEHOLDER_CID } from '../../../utils/car.utils';
import { createNftOutput } from '../../../utils/collection-minting-utils/nft.utils';
import { getProject, getProjects } from '../../../utils/common.utils';
import { getContentType } from '../../../utils/storage.utils';
import { createAliasOutput } from '../../../utils/token-minting-utils/alias.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { Wallet } from '../../wallet/wallet';
import { BaseService, HandlerParams } from '../base';

export class AwardFundService extends BaseService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);

    const awardDocRef = build5Db().doc(`${COL.AWARD}/${order.payload.award}`);
    const award = <Award>await this.transactionService.get(awardDocRef);

    if (award.funded) {
      await this.transactionService.createCredit(
        TransactionPayloadType.DATA_NO_LONGER_VALID,
        payment,
        match,
      );
      return;
    }

    if (award.badge.type === AwardBadgeType.NATIVE && award.badge.tokenReward) {
      const nativeTokens = match.to.nativeTokens || [];
      const nativeToken = nativeTokens.find((nt) => nt.id === award.badge.tokenId);
      const nativeTokensReceived = Number(nativeToken?.amount || 0);
      const nativeTokensExpected = award.badge.total * award.badge.tokenReward;
      if (nativeTokens.length !== 1 || nativeTokensReceived !== nativeTokensExpected) {
        await this.transactionService.createCredit(
          TransactionPayloadType.INVALID_AMOUNT,
          payment,
          match,
        );
        return;
      }
    }

    this.transactionService.markAsReconciled(order, match.msgId);

    this.transactionService.push({
      ref: awardDocRef,
      data: {
        funded: true,
        address: order.payload.targetAddress,
        fundedBy: order.member,
        mediaStatus: MediaStatus.PENDING_UPLOAD,
      },
      action: 'update',
    });

    const mintAliasOrder: Transaction = {
      project: getProject(order),
      projects: getProjects([order]),
      type: TransactionType.AWARD,
      uid: getRandomEthAddress(),
      member: order.member,
      space: order.space,
      network: order.network,
      payload: {
        type: TransactionPayloadType.MINT_ALIAS,
        amount: award.aliasStorageDeposit,
        sourceAddress: order.payload.targetAddress,
        targetAddress: order.payload.targetAddress,
        award: award.uid,
      },
    };
    const mintAliasTranDocRef = build5Db().doc(`${COL.TRANSACTION}/${mintAliasOrder.uid}`);
    this.transactionService.push({
      ref: mintAliasTranDocRef,
      data: mintAliasOrder,
      action: 'set',
    });

    if (order.payload.legacyAwardFundRequestId) {
      const legacyAwardFundRequesDocRef = build5Db().doc(
        `${COL.TRANSACTION}/${order.payload.legacyAwardFundRequestId}`,
      );
      this.transactionService.push({
        ref: legacyAwardFundRequesDocRef,
        data: { 'payload.legacyAwardsBeeingFunded': build5Db().inc(-1) },
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
  build5Id: award.uid,
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

    build5Id: badgeTransactionId,

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

export const getAwardgStorageDeposits = async (award: Award, token: Token, wallet: Wallet) => {
  const address = await wallet.getNewIotaAddressDetails();

  const aliasOutput = await createAliasOutput(wallet, address);

  const collectioIssuerAddress = new AliasAddress(aliasOutput.aliasId);

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${award.space}`);
  const space = <Space>await spaceDocRef.get();

  const collectionMetadata = await awardToCollectionMetadata(award, space);
  const collectionOutput = await createNftOutput(
    wallet,
    collectioIssuerAddress,
    collectioIssuerAddress,
    JSON.stringify(collectionMetadata),
  );

  const nttMetadata = await awardBadgeToNttMetadata(
    award,
    collectionOutput.nftId,
    getRandomEthAddress(),
    dayjs(),
    0,
  );
  const issuerAddress = new NftAddress(collectionOutput.nftId);
  const ownerAddress = new Ed25519Address(address.hex);
  const ntt = await createNftOutput(
    wallet,
    ownerAddress,
    issuerAddress,
    JSON.stringify(nttMetadata),
    dayjs().add(100, 'y'),
  );

  const storageDeposit = {
    aliasStorageDeposit: Number(aliasOutput.amount),
    collectionStorageDeposit: Number(collectionOutput.amount),
    nttStorageDeposit: Number(ntt.amount) * award.badge.total,
    nativeTokenStorageDeposit: 0,
  };

  if (award.badge.type === AwardBadgeType.NATIVE && award.badge.tokenReward) {
    const nativeTokenAmount = award.badge.total * award.badge.tokenReward;
    const nativeToken = {
      id: token?.mintingData?.tokenId!,
      amount: BigInt(nativeTokenAmount),
    };
    const nativeTokenOutput = await packBasicOutput(wallet, address.bech32, 0, {
      nativeTokens: [nativeToken],
    });
    storageDeposit.nativeTokenStorageDeposit = Number(nativeTokenOutput.amount);
  }

  return storageDeposit;
};
