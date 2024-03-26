import { build5Db } from '@build-5/database';
import { COL, MIN_IOTA_AMOUNT, Network, Space, Token, Transaction } from '@build-5/interfaces';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { getWallet, testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public network: Network = Network.RMS;
  public space: Space = {} as any;
  public token: Token = {} as any;

  public member: string = '';
  public memberAddress: AddressDetails = {} as any;
  public walletService: Wallet = {} as any;

  public tangleOrder: Transaction = {} as any;

  public beforeEach = async (network: Network) => {
    this.network = network;
    this.walletService = await getWallet(this.network);
    this.member = await testEnv.createMember();

    this.tangleOrder = await getTangleOrder(this.network);

    const memberData = await build5Db().doc(COL.MEMBER, this.member).get();
    const memberAddress = getAddress(memberData, this.network);
    this.memberAddress = await this.walletService.getAddressDetails(memberAddress);
    await requestFundsFromFaucet(this.network, memberAddress, 10 * MIN_IOTA_AMOUNT);
  };
}
