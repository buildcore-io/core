import { COL, Member, Network, Space, Transaction, TransactionType } from '@build-5/interfaces';
import { IQuery } from '../../src/firebase/firestore/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace } from '../../test/controls/common';
import { getTangleOrder } from '../common';

export class Helper {
  public walletSpy: any = {} as any;
  public guardian: string = '';
  public member: string = '';
  public space: Space = {} as any;
  public memberAddress: AddressDetails = {} as any;
  public walletService: SmrWallet = {} as any;
  public network = Network.RMS;
  public tangleOrder: Transaction = {} as any;
  public memberCreditQuery: IQuery = {} as any;
  public guardianCreditQuery: IQuery = {} as any;
  public guardianAddress: AddressDetails = {} as any;

  public beforeAll = async () => {
    this.walletService = (await WalletService.newWallet(this.network)) as SmrWallet;
    this.tangleOrder = await getTangleOrder();
  };

  public beforeEach = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.guardian = await createMember(this.walletSpy);
    this.member = await createMember(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian);

    const memberDocRef = soonDb().doc(`${COL.MEMBER}/${this.member}`);
    const memberData = <Member>await memberDocRef.get();
    const memberBech32 = getAddress(memberData, this.network);
    this.memberAddress = await this.walletService.getAddressDetails(memberBech32);

    const guardianDocRef = soonDb().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, this.network);
    this.guardianAddress = await this.walletService.getAddressDetails(guardianBech32);

    this.memberCreditQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', this.member);

    this.guardianCreditQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', this.guardian);
  };
}
