/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import { COL, Member, Network, SOON_PROJECT_ID, Token, TokenStatus } from '@buildcore/interfaces';
import { IotaWallet } from '../../src/services/wallet/IotaWalletService';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createRoyaltySpaces, getRandomSymbol } from '../../test/controls/common';
import { MEDIA, getWallet, testEnv } from '../../test/set-up';

export class Helper {
  public sourceNetwork = Network.ATOI;
  public targetNetwork = Network.RMS;
  public seller: Member | undefined;
  public sellerValidateAddress = {} as { [key: string]: AddressDetails };
  public buyer: Member | undefined;
  public buyerValidateAddress = {} as { [key: string]: AddressDetails };
  public token: Token | undefined;
  public rmsWallet: Wallet | undefined;
  public atoiWallet: IotaWallet | undefined;

  public beforeEach = async () => {
    await createRoyaltySpaces();
    const guardian = await testEnv.createMember();
    const space = await testEnv.createSpace(guardian);

    const sellerId = await testEnv.createMember();
    this.seller = <Member>await database().doc(COL.MEMBER, sellerId).get();

    this.atoiWallet = (await getWallet(Network.ATOI)) as IotaWallet;
    this.rmsWallet = await getWallet(Network.RMS);

    this.sellerValidateAddress[Network.ATOI] = await this.atoiWallet.getAddressDetails(
      this.seller.validatedAddress![Network.ATOI],
    );
    this.sellerValidateAddress[Network.RMS] = await this.rmsWallet.getAddressDetails(
      this.seller.validatedAddress![Network.RMS],
    );

    const buyerId = await testEnv.createMember();
    this.buyer = <Member>await database().doc(COL.MEMBER, buyerId).get();

    this.buyerValidateAddress[Network.ATOI] = await this.atoiWallet.getAddressDetails(
      this.buyer.validatedAddress![Network.ATOI],
    );
    this.buyerValidateAddress[Network.RMS] = await this.rmsWallet.getAddressDetails(
      this.buyer.validatedAddress![Network.RMS],
    );

    this.token = await this.saveToken(space.uid, guardian);
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
      links: [] as URL[],
    } as Token;
    await database().doc(COL.TOKEN, token.uid).create(token);
    return token;
  };
}
