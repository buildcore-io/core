import {
  COL,
  Collection,
  Network,
  Space,
  SpaceMember,
  SUB_COL,
  TransactionCreditType,
  TransactionOrder,
} from '@soonaverse/interfaces';
import admin, { inc } from '../../../admin.config';
import { serverTime } from '../../../utils/dateTime.utils';
import { AliasWallet } from '../../wallet/smr-wallets/AliasWallet';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { WalletService } from '../../wallet/wallet';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class SpaceService {
  constructor(readonly transactionService: TransactionService) {}

  public handleSpaceClaim = async (order: TransactionOrder, match: TransactionMatch) => {
    const payment = await this.transactionService.createPayment(order, match);
    await this.transactionService.createCredit(TransactionCreditType.SPACE_CALIMED, payment, match);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${order.space}`);
    const space = <Space>(await this.transactionService.transaction.get(spaceDocRef)).data();
    if (!space.collectionId || space.claimed) {
      return;
    }

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${space.collectionId}`);
    const collection = <Collection>(await collectionDocRef.get()).data();

    const senderIsAliasGovernor = await senderIsGovernerOfAlias(
      order.network!,
      match.from.address,
      collection,
    );
    if (!senderIsAliasGovernor) {
      return;
    }

    const spaceMember: SpaceMember = {
      uid: order.member!,
      parentId: space.uid,
      parentCol: COL.SPACE,
      createdOn: serverTime(),
    };
    const spaceGuardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(order.member!);
    this.transactionService.updates.push({
      ref: spaceGuardianDocRef,
      data: spaceMember,
      action: 'set',
      merge: true,
    });
    const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(order.member!);
    this.transactionService.updates.push({
      ref: spaceMemberDocRef,
      data: spaceMember,
      action: 'set',
      merge: true,
    });

    this.transactionService.updates.push({
      ref: spaceDocRef,
      data: { totalMembers: inc(1), totalGuardians: inc(1), claimed: true },
      action: 'update',
    });

    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${order.member}`);
    this.transactionService.updates.push({
      ref: memberDocRef,
      data: { spaces: { [space.uid]: { uid: space.uid, isMember: true } } },
      action: 'update',
      merge: true,
    });
  };
}

const senderIsGovernerOfAlias = async (
  network: Network,
  senderBech32: string,
  collection: Collection,
) => {
  const wallet = (await WalletService.newWallet(network)) as SmrWallet;
  const aliasWallet = new AliasWallet(wallet);
  const aliasOutputs = await aliasWallet.getAliasOutputs(senderBech32);
  for (const aliasOutput of Object.values(aliasOutputs)) {
    if (aliasOutput.aliasId === collection.mintingData?.aliasId) {
      return true;
    }
  }
  return false;
};
