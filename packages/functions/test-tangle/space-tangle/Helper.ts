import { IQuery, build5Db } from '@build-5/database';
import { COL, Member, Network, Space, Transaction, TransactionType } from '@build-5/interfaces';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { getTangleOrder } from '../common';

export class Helper {
  public walletSpy: any = {} as any;
  public guardian: string = '';
  public member: string = '';
  public space: Space = {} as any;
  public memberAddress: AddressDetails = {} as any;
  public walletService: Wallet = {} as any;
  public network = Network.RMS;
  public tangleOrder: Transaction = {} as any;
  public memberCreditQuery: IQuery = {} as any;
  public guardianCreditQuery: IQuery = {} as any;
  public guardianAddress: AddressDetails = {} as any;

  public beforeAll = async () => {
    this.walletService = await getWallet(this.network);
    this.tangleOrder = await getTangleOrder(Network.RMS);
  };

  public beforeEach = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.guardian = await createMember(this.walletSpy);
    this.member = await createMember(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian);

    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${this.member}`);
    const memberData = <Member>await memberDocRef.get();
    const memberBech32 = getAddress(memberData, this.network);
    this.memberAddress = await this.walletService.getAddressDetails(memberBech32);

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, this.network);
    this.guardianAddress = await this.walletService.getAddressDetails(guardianBech32);

    this.memberCreditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', this.member);

    this.guardianCreditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', this.guardian);
  };
}
