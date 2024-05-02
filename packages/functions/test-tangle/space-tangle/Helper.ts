import { IQuery, database } from '@buildcore/database';
import { COL, Member, Network, Space, Transaction, TransactionType } from '@buildcore/interfaces';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { getWallet, testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';

export class Helper {
  public guardian: string = '';
  public member: string = '';
  public space: Space = {} as any;
  public memberAddress: AddressDetails = {} as any;
  public walletService: Wallet = {} as any;
  public network = Network.RMS;
  public tangleOrder: Transaction = {} as any;
  public memberCreditQuery: IQuery<any, any> = {} as any;
  public guardianCreditQuery: IQuery<any, any> = {} as any;
  public guardianAddress: AddressDetails = {} as any;

  public beforeAll = async () => {
    this.walletService = await getWallet(this.network);
    this.tangleOrder = await getTangleOrder(Network.RMS);
  };

  public beforeEach = async () => {
    this.guardian = await testEnv.createMember();
    this.member = await testEnv.createMember();
    this.space = await testEnv.createSpace(this.guardian);

    const memberDocRef = database().doc(COL.MEMBER, this.member);
    const memberData = <Member>await memberDocRef.get();
    const memberBech32 = getAddress(memberData, this.network);
    this.memberAddress = await this.walletService.getAddressDetails(memberBech32);

    const guardianDocRef = database().doc(COL.MEMBER, this.guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, this.network);
    this.guardianAddress = await this.walletService.getAddressDetails(guardianBech32);

    this.memberCreditQuery = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', this.member);

    this.guardianCreditQuery = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', this.guardian);
  };
}
