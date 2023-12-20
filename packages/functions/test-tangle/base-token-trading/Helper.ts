/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import { COL, Member, Network, SOON_PROJECT_ID, Token, TokenStatus } from '@build-5/interfaces';
import { createMember } from '../../src/runtime/firebase/member';
import { IotaWallet } from '../../src/services/wallet/IotaWalletService';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember as createMemberTest,
  createRoyaltySpaces,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
} from '../../test/controls/common';
import { MEDIA, getWallet, testEnv } from '../../test/set-up';
import { addValidatedAddress } from '../common';

export class Helper {
  public sourceNetwork = Network.ATOI;
  public targetNetwork = Network.RMS;
  public seller: Member | undefined;
  public sellerValidateAddress = {} as { [key: string]: AddressDetails };
  public buyer: Member | undefined;
  public buyerValidateAddress = {} as { [key: string]: AddressDetails };
  public token: Token | undefined;
  public walletSpy: any | undefined;
  public rmsWallet: Wallet | undefined;
  public atoiWallet: IotaWallet | undefined;

  public beforeEach = async () => {
    await createRoyaltySpaces();
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    const guardian = await createMemberTest(this.walletSpy);
    const space = await createSpace(this.walletSpy, guardian);

    const sellerId = wallet.getRandomEthAddress();
    mockWalletReturnValue(this.walletSpy, sellerId, {});
    await testEnv.wrap(createMember)({ address: sellerId });
    this.sellerValidateAddress[Network.ATOI] = await addValidatedAddress(Network.ATOI, sellerId);
    this.sellerValidateAddress[Network.RMS] = await addValidatedAddress(Network.RMS, sellerId);
    this.seller = <Member>await build5Db().doc(`${COL.MEMBER}/${sellerId}`).get();

    const buyerId = wallet.getRandomEthAddress();
    mockWalletReturnValue(this.walletSpy, buyerId, {});
    await testEnv.wrap(createMember)({ address: buyerId });
    this.buyerValidateAddress[Network.ATOI] = await addValidatedAddress(Network.ATOI, buyerId);
    this.buyerValidateAddress[Network.RMS] = await addValidatedAddress(Network.RMS, buyerId);
    this.buyer = <Member>await build5Db().doc(`${COL.MEMBER}/${buyerId}`).get();
    this.token = await this.saveToken(space.uid, guardian);

    this.atoiWallet = (await getWallet(Network.ATOI)) as IotaWallet;
    this.rmsWallet = await getWallet(Network.RMS);
  };

  public saveToken = async (space: string, guardian: string) => {
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
      status: TokenStatus.BASE,
      access: 0,
      icon: MEDIA,
      mintingData: {
        network: Network.ATOI,
      },
    };
    await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
    return token as Token;
  };
}
