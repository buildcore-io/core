import {
  AwardTypeDeprecated,
  COL,
  Member,
  Network,
  Space,
  Token,
  TokenStatus,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { xpTokenGuardianId, xpTokenId, xpTokenUid } from '../../src/utils/config.utils';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace } from '../../test/controls/common';
import { MEDIA, projectId, testEnv } from '../../test/set-up';

export let createdBy = '';

export class Helper {
  public guardian: string = '';
  public member: string = '';
  public space: Space = {} as any;
  public walletSpy: any = {} as any;
  public guardianAddress: AddressDetails = {} as any;
  public wallet: SmrWallet = {} as any;
  public token: Token = {} as any;

  public beforeEach = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.wallet = (await WalletService.newWallet(Network.RMS)) as SmrWallet;
    this.token = (await this.saveXpToken()) as any;

    const tmpMemberId = await createMember(this.walletSpy);
    const tmpMemberDocRef = admin.firestore().doc(`${COL.MEMBER}/${tmpMemberId}`);
    const tmpMember = <Member>(await tmpMemberDocRef.get()).data();
    const tokenGuardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${xpTokenGuardianId()}`);
    await tokenGuardianDocRef.set({ ...tmpMember, uid: xpTokenGuardianId() });

    this.guardian = await createMember(this.walletSpy);
    this.member = await createMember(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian);
    createdBy = wallet.getRandomEthAddress();

    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardian = <Member>(await guardianDocRef.get()).data();
    this.guardianAddress = await this.wallet.getAddressDetails(getAddress(guardian, Network.RMS));
  };

  public saveXpToken = async () => {
    const xpToken = {
      symbol: 'XPT',
      approved: true,
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space: 'asd',
      uid: xpTokenUid(),
      createdBy: xpTokenGuardianId(),
      name: 'xptoken',
      status: TokenStatus.MINTED,
      access: 0,
      icon: MEDIA,
      mintingData: {
        network: Network.RMS,
        tokenId: xpTokenId(),
      },
    };
    await admin.firestore().doc(`${COL.TOKEN}/${xpToken.uid}`).set(xpToken);
    return xpToken;
  };

  public clearDb = async () => {
    await testEnv.firestore.clearFirestoreData(projectId);
  };
}

export const VAULT_MNEMONIC =
  'swamp title blade inform spray abstract wink grab gallery vessel share flag unaware possible tree unaware elephant east winner obey naive wine book boring';

export const MINTED_TOKEN_ID =
  '0x08f800d9e15c1da60c36cb0b2d4a02366ea3e200a65fc071a9e25f09b7fb9e951f0100000000';

export const awardBaseProps = (space: string) => ({
  uid: wallet.getRandomEthAddress(),
  name: 'award',
  description: 'awrddesc',
  space,
  createdBy,
  type: AwardTypeDeprecated.CUSTOM,
  owners: {
    ['asd']: wallet.getRandomEthAddress(),
  },
  participants: {
    ['asd']: wallet.getRandomEthAddress(),
  },
  approved: true,
  rejected: false,
  completed: false,
});

export const badgeBaseProps = () => ({
  name: 'badge',
  description: 'badgedesc',
  image: { original: 'bafkreiapx7kczhfukx34ldh3pxhdip5kgvh237dlhp55koefjo6tyupnj4' },
});

export const newAward = (space: string): any => ({
  ...awardBaseProps(space),
  endDate: dateToTimestamp(dayjs().add(2, 'd')),
  badge: {
    ...badgeBaseProps(),
    count: 10,
    xp: 10,
  },
  issued: 0,
  completed: false,
});

export const halfCompletedAward = (space: string): any => ({
  ...awardBaseProps(space),
  endDate: dateToTimestamp(dayjs().add(2, 'd')),
  badge: {
    ...badgeBaseProps(),
    count: 10,
    xp: 10,
  },
  issued: 5,
  completed: false,
});

export const fullyCompletedAward = (space: string): any => ({
  ...awardBaseProps(space),
  endDate: dateToTimestamp(dayjs().add(2, 'd')),
  badge: {
    ...badgeBaseProps(),
    count: 10,
    xp: 10,
  },
  issued: 10,
  completed: true,
});
