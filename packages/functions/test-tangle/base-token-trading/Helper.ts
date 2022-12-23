/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Member, Network, Token, TokenStatus } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { createMember } from '../../src/controls/member.control';
import { IotaWallet } from '../../src/services/wallet/IotaWalletService';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../../src/services/wallet/wallet';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember as createMemberTest,
  createRoyaltySpaces,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  saveSoon,
} from '../../test/controls/common';
import { getWallet, MEDIA, testEnv } from '../../test/set-up';
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
  public rmsWallet: SmrWallet | undefined;
  public atoiWallet: IotaWallet | undefined;
  public soonTokenId = '';

  public beforeEach = async () => {
    this.soonTokenId = await saveSoon();
    await createRoyaltySpaces();
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    const guardian = await createMemberTest(this.walletSpy);
    const space = await createSpace(this.walletSpy, guardian);

    const sellerId = wallet.getRandomEthAddress();
    mockWalletReturnValue(this.walletSpy, sellerId, {});
    await testEnv.wrap(createMember)(sellerId);
    this.sellerValidateAddress[Network.ATOI] = await addValidatedAddress(Network.ATOI, sellerId);
    this.sellerValidateAddress[Network.RMS] = await addValidatedAddress(Network.RMS, sellerId);
    this.seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sellerId}`).get()).data();

    const buyerId = wallet.getRandomEthAddress();
    mockWalletReturnValue(this.walletSpy, buyerId, {});
    await testEnv.wrap(createMember)(buyerId);
    this.buyerValidateAddress[Network.ATOI] = await addValidatedAddress(Network.ATOI, buyerId);
    this.buyerValidateAddress[Network.RMS] = await addValidatedAddress(Network.RMS, buyerId);
    this.buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buyerId}`).get()).data();
    this.token = await this.saveToken(space.uid, guardian);

    this.atoiWallet = (await getWallet(Network.ATOI)) as IotaWallet;
    this.rmsWallet = (await getWallet(Network.RMS)) as SmrWallet;
  };

  public saveToken = async (space: string, guardian: string) => {
    const token = {
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
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
    return token as Token;
  };
}
