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
  GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE,
  IAliasOutput,
  IGovernorAddressUnlockCondition,
  IIssuerFeature,
  INftOutput,
  ISSUER_FEATURE_TYPE,
  IndexerPluginClient,
} from '@iota/iota.js-next';
import { build5Db } from '../../../firebase/firestore/build5Db';
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
  const indexer = new IndexerPluginClient(wallet.client);
  const hrp = wallet.info.protocol.bech32Hrp;

  const aliasId = collection.mintingData?.aliasId;
  if (aliasId) {
    const aliasOutputId = (await indexer.alias(aliasId)).items[0];
    const aliasOutput = (await wallet.client.output(aliasOutputId)).output as IAliasOutput;

    const unlockConditions = aliasOutput.unlockConditions
      .filter((uc) => uc.type === GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE)
      .map((uc) => <IGovernorAddressUnlockCondition>uc);

    for (const unlockCondition of unlockConditions) {
      const bech32 = Bech32AddressHelper.buildAddress(hrp, unlockCondition.address);
      if (bech32 === senderBech32) {
        return true;
      }
    }

    return false;
  }

  const collectionOutputId = (await indexer.nft(collection.mintingData?.nftId!)).items[0];
  const collectionOutput = (await wallet.client.output(collectionOutputId)).output as INftOutput;
  const issuer = <IIssuerFeature | undefined>(
    collectionOutput.immutableFeatures?.find((f) => f.type === ISSUER_FEATURE_TYPE)
  );
  return issuer && Bech32AddressHelper.buildAddress(hrp, issuer.address) === senderBech32;
};
