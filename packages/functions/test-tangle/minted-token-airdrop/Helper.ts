/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  Network,
  Space,
  Token,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, getRandomSymbol } from '../../test/controls/common';
import { MEDIA, getWallet } from '../../test/set-up';

export class Helper {
  public network = Network.RMS;
  public space: Space | undefined;
  public token: Token | undefined;

  public guardian: string | undefined;
  public member: string | undefined;
  public walletService: Wallet | undefined;
  public walletSpy: any;

  public berforeAll = async () => {
    this.walletService = await getWallet(this.network);
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
  };

  public beforeEach = async () => {
    this.guardian = await createMember(this.walletSpy);
    this.member = await createMember(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian);
    this.token = (await saveToken(this.space.uid, this.guardian, this.walletService!)) as Token;
  };

  public getAirdropsForMember = async (member: string, status = TokenDropStatus.UNCLAIMED) => {
    const snap = await build5Db()
      .collection(COL.AIRDROP)
      .where('member', '==', member)
      .where('status', '==', status)
      .get();
    return snap.map((d) => d as TokenDrop);
  };
}

export const saveToken = async (
  space: string,
  guardian: string,
  walletService: Wallet,
  tokenId = MINTED_TOKEN_ID,
) => {
  const vaultAddress = await walletService.getIotaAddressDetails(VAULT_MNEMONIC);
  await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic);
  const token = {
    symbol: getRandomSymbol(),
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: wallet.getRandomEthAddress(),
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.MINTED,
    mintingData: {
      tokenId,
      network: Network.RMS,
      vaultAddress: vaultAddress.bech32,
      tokensInVault: 0,
    },
    access: 0,
    icon: MEDIA,
  };
  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token;
};

export const dummyTokenId =
  '0x080c409a8c0ffa795676e55f24e0223e5b48dbe2b1bc4314140333543b5e7e8d360100000000';

export const VAULT_MNEMONIC =
  'add peanut behind flame hundred luxury dress loan anger depth tag round elbow damage celery clever crew question enlist near gun differ when already';
export const MINTED_TOKEN_ID =
  '0x08d5d8c4f4139a3d09e780edd4826162c095b787ab94af7425c0d079b0b8e4302e0100000000';
