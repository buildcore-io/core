import { COL, Member, Network, Space, SUB_COL, Token, TokenStatus } from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { mintTokenOrder } from '../../src/runtime/firebase/token/minting';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../../test/controls/common';
import { getWallet, MEDIA, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public guardian: Member = {} as any;
  public address: AddressDetails = {} as any;
  public space: Space = {} as any;
  public importSpace: Space = {} as any;
  public token: Token = {} as any;
  public walletService: SmrWallet = {} as any;
  public member: string = '';
  public walletSpy: any = {} as any;
  public network = Network.RMS;
  public totalSupply = 1500;

  public beforeEach = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');

    const guardianId = await createMember(this.walletSpy);
    this.member = await createMember(this.walletSpy);
    this.guardian = <Member>await build5Db().doc(`${COL.MEMBER}/${guardianId}`).get();
    this.space = await createSpace(this.walletSpy, this.guardian.uid);
    this.importSpace = await createSpace(this.walletSpy, this.guardian.uid);
    this.token = await this.saveToken(this.space.uid, this.guardian.uid, this.member);
    this.walletService = (await getWallet(this.network)) as SmrWallet;
    this.address = await this.walletService.getAddressDetails(
      getAddress(this.guardian, this.network),
    );

    mockWalletReturnValue(this.walletSpy, this.guardian.uid, {
      token: this.token.uid,
      network: this.network,
    });
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(this.network, order.payload.targetAddress, order.payload.amount);

    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${this.token.uid}`);
    await wait(async () => {
      this.token = <Token>await tokenDocRef.get();
      return this.token.status === TokenStatus.MINTED;
    });

    await tokenDocRef.delete();
  };

  public saveToken = async (space: string, guardian: string, member: string) => {
    const tokenId = getRandomEthAddress();
    const token = {
      symbol: getRandomSymbol(),
      totalSupply: this.totalSupply,
      approved: true,
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space,
      uid: tokenId,
      createdBy: guardian,
      name: 'MyToken',
      status: TokenStatus.AVAILABLE,
      access: 0,
      description: 'myrandomtoken',
      icon: MEDIA,
      decimals: 4,
    };
    await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
    await build5Db()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`)
      .set({ tokenOwned: 1000 });
    return <Token>token;
  };
}
