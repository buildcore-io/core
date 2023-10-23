import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  Network,
  SUB_COL,
  Space,
  SpaceMember,
  Transaction,
  TransactionPayloadType,
} from '@build-5/interfaces';
import {
  AliasOutput,
  FeatureType,
  GovernorAddressUnlockCondition,
  IssuerFeature,
  NftOutput,
  UnlockConditionType,
} from '@iota/sdk';
import { Bech32AddressHelper } from '../../../utils/bech32-address.helper';
import { serverTime } from '../../../utils/dateTime.utils';
import { WalletService } from '../../wallet/wallet.service';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class SpaceService {
  constructor(readonly transactionService: TransactionService) {}

  public handleSpaceClaim = async (order: Transaction, match: TransactionMatch) => {
    const payment = await this.transactionService.createPayment(order, match);
    await this.transactionService.createCredit(
      TransactionPayloadType.SPACE_CALIMED,
      payment,
      match,
    );

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${order.space}`);
    const space = <Space>await this.transactionService.get(spaceDocRef);
    if (!space.collectionId || space.claimed) {
      return;
    }

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${space.collectionId}`);
    const collection = <Collection>await collectionDocRef.get();

    const senderIsIssuer = await senderIsCollectionIssuer(order.network!, match.from, collection);
    if (!senderIsIssuer) {
      return;
    }

    const spaceMember: SpaceMember = {
      uid: order.member!,
      parentId: space.uid,
      parentCol: COL.SPACE,
      createdOn: serverTime(),
    };
    const spaceGuardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(order.member!);
    this.transactionService.push({
      ref: spaceGuardianDocRef,
      data: spaceMember,
      action: 'set',
      merge: true,
    });
    const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(order.member!);
    this.transactionService.push({
      ref: spaceMemberDocRef,
      data: spaceMember,
      action: 'set',
      merge: true,
    });

    this.transactionService.push({
      ref: spaceDocRef,
      data: { totalMembers: build5Db().inc(1), totalGuardians: build5Db().inc(1), claimed: true },
      action: 'update',
    });

    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${order.member}`);
    this.transactionService.push({
      ref: memberDocRef,
      data: { spaces: { [space.uid]: { uid: space.uid, isMember: true } } },
      action: 'update',
      merge: true,
    });
  };
}

const senderIsCollectionIssuer = async (
  network: Network,
  senderBech32: string,
  collection: Collection,
) => {
  const wallet = await WalletService.newWallet(network);
  const hrp = wallet.info.protocol.bech32Hrp;

  const aliasId = collection.mintingData?.aliasId;
  if (aliasId) {
    const aliasOutputId = await wallet.client.aliasOutputId(aliasId);
    const aliasOutput = (await wallet.client.getOutput(aliasOutputId)).output as AliasOutput;

    const unlockConditions = aliasOutput.unlockConditions
      .filter((uc) => uc.type === UnlockConditionType.GovernorAddress)
      .map((uc) => <GovernorAddressUnlockCondition>uc);

    for (const unlockCondition of unlockConditions) {
      const bech32 = Bech32AddressHelper.addressToBech32(
        (unlockCondition as GovernorAddressUnlockCondition).address,
        hrp,
      );
      if (bech32 === senderBech32) {
        return true;
      }
    }

    return false;
  }

  const collectionOutputId = await wallet.client.nftOutputId(collection.mintingData?.nftId!);
  const collectionOutput = (await wallet.client.getOutput(collectionOutputId)).output as NftOutput;
  const issuer = <IssuerFeature | undefined>(
    collectionOutput.immutableFeatures?.find((f) => f.type === FeatureType.Issuer)
  );
  return issuer && Bech32AddressHelper.addressToBech32(issuer.address, hrp) === senderBech32;
};
