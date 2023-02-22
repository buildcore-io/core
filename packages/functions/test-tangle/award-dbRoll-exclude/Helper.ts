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

  awardBaseProps = () => ({
    uid: wallet.getRandomEthAddress(),
    name: 'award',
    description: 'awrddesc',
    space: this.space.uid,
    createdBy: this.guardian,
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

  public badgeBaseProps = () => ({
    name: 'badge',
    description: 'badgedesc',
    image: {
      original: 'bafybeierir2b444szt6hrrdcg2ocdf332h5aw3mysow6r6yllzdtdcytu4',
      fileName: '2433',
    },
  });

  public newAward = (): any => ({
    ...this.awardBaseProps(),
    endDate: dateToTimestamp(dayjs().add(2, 'd')),
    badge: {
      ...this.badgeBaseProps(),
      count: 10,
      xp: 10,
    },
    issued: 0,
    completed: false,
  });

  public halfCompletedAward = (): any => ({
    ...this.awardBaseProps(),
    endDate: dateToTimestamp(dayjs().add(2, 'd')),
    badge: {
      ...this.badgeBaseProps(),
      count: 10,
      xp: 10,
    },
    issued: 5,
    completed: false,
  });

  public fullyCompletedAward = (): any => ({
    ...this.awardBaseProps(),
    endDate: dateToTimestamp(dayjs().add(2, 'd')),
    badge: {
      ...this.badgeBaseProps(),
      count: 10,
      xp: 10,
    },
    issued: 10,
    completed: true,
  });

  public clearDb = () => testEnv.firestore.clearFirestoreData(projectId);
}

export const VAULT_MNEMONIC =
  'swamp title blade inform spray abstract wink grab gallery vessel share flag unaware possible tree unaware elephant east winner obey naive wine book boring';

export const MINTED_TOKEN_ID =
  '0x08f800d9e15c1da60c36cb0b2d4a02366ea3e200a65fc071a9e25f09b7fb9e951f0100000000';
