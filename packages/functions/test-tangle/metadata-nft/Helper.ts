import { COL, MIN_IOTA_AMOUNT, Member, Network, Space, Token } from '@soonaverse/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public network = Network.RMS;
  public space: Space = {} as any;
  public token: Token = {} as any;

  public member: string = '';
  public memberAddress: AddressDetails = {} as any;
  public walletService: SmrWallet = {} as any;
  public walletSpy: any;

  public berforeAll = async () => {
    this.walletService = (await getWallet(this.network)) as SmrWallet;
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
  };

  public beforeEach = async () => {
    this.member = await createMember(this.walletSpy);

    const memberData = await soonDb().doc(`${COL.MEMBER}/${this.member}`).get<Member>();
    const memberAddress = getAddress(memberData, this.network);
    this.memberAddress = await this.walletService.getAddressDetails(memberAddress);
    await requestFundsFromFaucet(this.network, memberAddress, 10 * MIN_IOTA_AMOUNT);
  };
}
