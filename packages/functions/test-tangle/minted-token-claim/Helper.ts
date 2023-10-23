import { build5Db } from '@build-5/database';
import { COL, Member, Network, Space, TokenStatus } from '@build-5/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as walletUtil from '../../src/utils/wallet.utils';
import { createMember, createSpace, getRandomSymbol } from '../../test/controls/common';
import { MEDIA, getWallet } from '../../test/set-up';

export class Helper {
  public walletSpy: any;
  public network = Network.RMS;
  public guardian: Member = {} as any;
  public space: Space = {} as any;
  public token: any = {} as any;
  public wallet: Wallet = {} as any;

  public beforeEach = async (vaultMnemonic: string, mintedTokenId: string, notMinted = false) => {
    this.wallet = await getWallet(this.network);
    this.walletSpy = jest.spyOn(walletUtil, 'decodeAuth');

    const guardianId = await createMember(this.walletSpy);
    this.guardian = <Member>await build5Db().doc(`${COL.MEMBER}/${guardianId}`).get();

    this.space = await createSpace(this.walletSpy, this.guardian.uid);
    this.token = await this.saveToken(
      this.space.uid,
      this.guardian.uid,
      vaultMnemonic,
      mintedTokenId,
      notMinted,
    );
  };

  public saveToken = async (
    space: string,
    guardian: string,
    vaultMnemonic: string,
    mintedTokenId: string,
    notMinted = false,
  ) => {
    const vaultAddress = await this.wallet.getIotaAddressDetails(vaultMnemonic);
    await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic);
    const tokenId = walletUtil.getRandomEthAddress();
    const token = {
      symbol: getRandomSymbol(),
      approved: true,
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space,
      uid: tokenId,
      createdBy: guardian,
      name: 'MyToken',
      status: notMinted ? TokenStatus.AVAILABLE : TokenStatus.MINTED,
      mintingData: notMinted
        ? {}
        : {
            tokenId: mintedTokenId,
            network: Network.RMS,
            vaultAddress: vaultAddress.bech32,
            tokensInVault: 10,
          },
      access: 0,
      totalSupply: 10,
      icon: MEDIA,
    };
    await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
    return token;
  };
}
