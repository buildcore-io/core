import {
  COL,
  MIN_IOTA_AMOUNT,
  Space,
  TokenAllocation,
  WenError,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../../src/admin.config';
import { createToken, setTokenAvailableForSale } from '../../../src/runtime/firebase/token/base';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  getRandomSymbol,
  mockWalletReturnValue,
} from '../common';

let walletSpy: any;

const dummyToken = (space: string) =>
  ({
    name: 'MyToken',
    symbol: getRandomSymbol(),
    space,
    totalSupply: 1000,
    allocations: <TokenAllocation[]>[{ title: 'Allocation1', percentage: 100 }],
    icon: MEDIA,
    overviewGraphics: MEDIA,
    termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
    access: 0,
    decimals: 6,
  } as any);

describe('Token controller: ' + WEN_FUNC.setTokenAvailableForSale, () => {
  let memberAddress: string;
  let space: Space;
  let token: any;
  let publicTime = {
    saleStartDate: dayjs().toDate(),
    saleLength: 86400000 * 2,
    coolDownLength: 86400000,
  };

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, memberAddress);
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid));
    token = await testEnv.wrap(createToken)({});
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true });
  });

  it('Should throw, not approved', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    await expectThrow(testEnv.wrap(setTokenAvailableForSale)({}), WenError.token_not_approved.key);
  });

  it('Should throw, rejected', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ approved: true, rejected: true });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    await expectThrow(testEnv.wrap(setTokenAvailableForSale)({}), WenError.token_not_approved.key);
  });

  it('Should throw, not on public sale', async () => {
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    await expectThrow(
      testEnv.wrap(setTokenAvailableForSale)({}),
      WenError.no_token_public_sale.key,
    );
  });

  it('Should throw, not guardian', async () => {
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), updateData);
    await expectThrow(
      testEnv.wrap(setTokenAvailableForSale)({}),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should set public availability', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );
    expect(result?.saleLength).toBe(2 * 86400000);
    expect(result?.coolDownEnd.toDate()).toEqual(
      dateToTimestamp(
        dayjs(publicTime.saleStartDate).add(86400000 * 2 + 86400000, 'ms'),
        true,
      ).toDate(),
    );
    expect(result?.autoProcessAt100Percent).toBe(false);
  });

  it('Should set public availability', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = {
      token: token.uid,
      ...publicTime,
      autoProcessAt100Percent: true,
      pricePerToken: MIN_IOTA_AMOUNT,
    };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );
    expect(result?.saleLength).toBe(2 * 86400000);
    expect(result?.coolDownEnd.toDate()).toEqual(
      dateToTimestamp(
        dayjs(publicTime.saleStartDate).add(86400000 * 2 + 86400000, 'ms'),
        true,
      ).toDate(),
    );
    expect(result?.autoProcessAt100Percent).toBe(true);
  });

  it('Should throw, can not set public availability twice', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      ...publicTime,
      pricePerToken: MIN_IOTA_AMOUNT,
    });
    await testEnv.wrap(setTokenAvailableForSale)({});

    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      ...publicTime,
      pricePerToken: MIN_IOTA_AMOUNT,
    });
    await expectThrow(
      testEnv.wrap(setTokenAvailableForSale)({}),
      WenError.public_sale_already_set.key,
    );
  });

  it('Should set no cool down length', async () => {
    const docRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    await docRef.update({
      allocations: [{ title: 'public', percentage: 100, isPublicSale: true }],
    });
    const publicTime = {
      saleStartDate: dayjs().toDate(),
      saleLength: 86400000 * 2,
      coolDownLength: 0,
    };
    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      ...publicTime,
      pricePerToken: MIN_IOTA_AMOUNT,
    });
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.saleStartDate.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );
    expect(result?.saleLength).toBe(publicTime.saleLength);
    expect(result?.coolDownEnd.toDate()).toEqual(
      dateToTimestamp(
        dayjs(publicTime.saleStartDate).add(publicTime.saleLength, 'ms'),
        true,
      ).toDate(),
    );
  });
});
