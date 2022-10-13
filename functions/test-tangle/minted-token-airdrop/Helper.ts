/* eslint-disable @typescript-eslint/no-explicit-any */
import { Network, Space, Token, TokenStatus } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import admin from '../../src/admin.config';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { WalletService } from '../../src/services/wallet/wallet';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, getRandomSymbol } from '../../test/controls/common';
import { MilestoneListener } from '../db-sync.utils';

export class Helper {
  public network = Network.RMS;
  public listener: MilestoneListener | undefined;
  public space: Space | undefined;
  public token: Token | undefined;

  public guardian: string | undefined;
  public member: string | undefined;
  public walletService: SmrWallet | undefined;
  public walletSpy: any;

  public berforeAll = async () => {
    this.walletService = (await WalletService.newWallet(this.network)) as SmrWallet;
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.listener = new MilestoneListener(this.network);
  };

  public beforeEach = async () => {
    this.guardian = await createMember(this.walletSpy);
    this.member = await createMember(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian);
    this.token = (await saveToken(this.space.uid, this.guardian, this.walletService!)) as Token;
  };
}

export const saveToken = async (
  space: string,
  guardian: string,
  walletService: SmrWallet,
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
    },
    access: 0,
  };
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token;
};

export const dummyTokenId =
  '0x080c409a8c0ffa795676e55f24e0223e5b48dbe2b1bc4314140333543b5e7e8d360100000000';

export const VAULT_MNEMONIC =
'truth summer cart grow six hole thought enjoy example feed gas swift replace fabric february spawn chunk explain brain parade genre anchor express join'
export const MINTED_TOKEN_ID =
  '0x08d7d068fcb11355cbf06be907f4e113299864c4ec1324326b9328c14e1999c1420100000000';
