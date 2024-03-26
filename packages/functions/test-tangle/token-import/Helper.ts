import { build5Db } from '@build-5/database';
import {
  COL,
  Member,
  Network,
  SUB_COL,
  Space,
  Token,
  TokenStatus,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public guardian: Member = {} as any;
  public address: AddressDetails = {} as any;
  public space: Space = {} as any;
  public importSpace: Space = {} as any;
  public token: Token = {} as any;
  public walletService: Wallet = {} as any;
  public member: string = '';
  public network = Network.RMS;
  public totalSupply = 1500;

  public beforeEach = async () => {
    const guardianId = await testEnv.createMember();
    this.member = await testEnv.createMember();
    this.guardian = <Member>await build5Db().doc(COL.MEMBER, guardianId).get();
    this.space = await testEnv.createSpace(this.guardian.uid);
    this.importSpace = await testEnv.createSpace(this.guardian.uid);
    this.token = await this.saveToken(this.space.uid, this.guardian.uid, this.member);
    this.walletService = await getWallet(this.network);
    this.address = await this.walletService.getAddressDetails(
      getAddress(this.guardian, this.network),
    );

    mockWalletReturnValue(this.guardian.uid, {
      token: this.token.uid,
      network: this.network,
    });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder);
    await requestFundsFromFaucet(this.network, order.payload.targetAddress, order.payload.amount);

    const tokenDocRef = build5Db().doc(COL.TOKEN, this.token.uid);
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
    } as Token;
    await build5Db().doc(COL.TOKEN, token.uid).create(token);
    await build5Db()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member)
      .upsert({ tokenOwned: 1000 });
    return <Token>token;
  };
}
