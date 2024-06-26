import { database } from '@buildcore/database';
import {
  COL,
  Member,
  Network,
  SOON_PROJECT_ID,
  Space,
  Token,
  TokenStatus,
} from '@buildcore/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as walletUtil from '../../src/utils/wallet.utils';
import { getRandomSymbol } from '../../test/controls/common';
import { MEDIA, getWallet, testEnv } from '../../test/set-up';

export class Helper {
  public network = Network.RMS;
  public guardian: Member = {} as any;
  public space: Space = {} as any;
  public token: any = {} as any;
  public wallet: Wallet = {} as any;

  public beforeEach = async (vaultMnemonic: string, mintedTokenId: string, notMinted = false) => {
    this.wallet = await getWallet(this.network);

    const guardianId = await testEnv.createMember();
    this.guardian = <Member>await database().doc(COL.MEMBER, guardianId).get();

    this.space = await testEnv.createSpace(this.guardian.uid);
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
      project: SOON_PROJECT_ID,
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
    } as Token;
    await database().doc(COL.TOKEN, token.uid).create(token);
    return token;
  };
}
