/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import {
  COL,
  Network,
  SOON_PROJECT_ID,
  Space,
  Token,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
} from '@build-5/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomSymbol } from '../../test/controls/common';
import { MEDIA, getWallet, testEnv } from '../../test/set-up';

export class Helper {
  public network = Network.RMS;
  public space: Space = {} as any;
  public token: Token = {} as any;

  public guardian = '';
  public member = '';
  public walletService: Wallet = {} as any;

  public berforeAll = async () => {
    this.walletService = await getWallet(this.network);
  };

  public beforeEach = async () => {
    this.guardian = await testEnv.createMember();
    this.member = await testEnv.createMember();
    this.space = await testEnv.createSpace(this.guardian);
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
    project: SOON_PROJECT_ID,
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
  } as Token;
  await build5Db().doc(COL.TOKEN, token.uid).create(token);
  return token;
};

export const dummyTokenId =
  '0x080c409a8c0ffa795676e55f24e0223e5b48dbe2b1bc4314140333543b5e7e8d360100000000';

export const VAULT_MNEMONIC =
  'pipe jump moment hybrid palm faint wait minute sustain crane income unable hobby antique bleak advance deputy mandate explain clip deal viable sponsor silly';
export const MINTED_TOKEN_ID =
  '0x08774bcb5848829764241e1bd5b1a8ebb6da08f22e88c2f656d1fa4deafb3217bc0100000000';
