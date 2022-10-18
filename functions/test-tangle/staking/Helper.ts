/* eslint-disable @typescript-eslint/no-explicit-any */
import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { Member, Network, Space, Token, TokenStatus } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import admin from '../../src/admin.config';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, getRandomSymbol } from '../../test/controls/common';
import { MilestoneListener } from '../db-sync.utils';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

export class Helper {
  public TOKEN_ID =
    '0x08319d70d87e0296576769a768a0dd16953676d01046cea911c3dde62fb00f0eb40100000000';
  public VAULT_MNEMONIC =
    'multiply sound whale way attract dentist identify wear much oxygen matter movie harsh oil vintage real island history era galaxy image wonder usage giraffe';

  public listenerRMS: MilestoneListener | undefined;
  public member: Member | undefined;
  public memberAddress: AddressDetails | undefined;
  public space: Space | undefined;
  public walletService: SmrWallet | undefined;
  public walletSpy: any;
  public network = Network.RMS;
  public token: Token | undefined;

  public beforeAll = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.listenerRMS = new MilestoneListener(this.network);
    this.walletService = (await WalletService.newWallet(this.network)) as SmrWallet;
  };

  public beforeEach = async () => {
    const memberId = await createMember(this.walletSpy);
    this.member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${memberId}`).get()).data();
    this.memberAddress = await this.walletService!.getAddressDetails(
      getAddress(this.member, this.network),
    );
    this.space = await createSpace(this.walletSpy, memberId);
    this.token = await this.saveToken(this.space!.uid, this.member.uid);
    await requestFundsFromFaucet(this.network, this.memberAddress.bech32, 10 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      this.walletService!,
      this.memberAddress,
      this.TOKEN_ID,
      this.VAULT_MNEMONIC,
      100,
    );
  };

  public saveToken = async (space: string, guardian: string) => {
    const vaultAddress = await this.walletService!.getIotaAddressDetails(this.VAULT_MNEMONIC);
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
        tokenId: this.TOKEN_ID,
        network: Network.RMS,
        vaultAddress: vaultAddress.bech32,
      },
      access: 0,
    };
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
    return <Token>token;
  };
}
