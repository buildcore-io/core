import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  Space,
  Token,
  TokenAllocation,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../set-up';
import { expectThrow, getRandomSymbol } from '../common';
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
  }) as any;

describe('Token controller: ' + WEN_FUNC.setTokenAvailableForSale, () => {
  let memberAddress: NetworkAddress;
  let space: Space;
  let token: any;
  let publicTime = {
    saleStartDate: dayjs().toDate(),
    saleLength: 86400000 * 2,
    coolDownLength: 86400000,
  };
  beforeEach(async () => {
    memberAddress = await testEnv.createMember();
    space = await testEnv.createSpace(memberAddress);
    mockWalletReturnValue(memberAddress, dummyToken(space.uid));
    token = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    await database().doc(COL.TOKEN, token.uid).update({ approved: true });
  });

  it('Should throw, not approved', async () => {
    await database().doc(COL.TOKEN, token.uid).update({ approved: false });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(memberAddress, updateData);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.setTokenAvailableForSale),
      WenError.token_not_approved.key,
    );
  });

  it('Should throw, rejected', async () => {
    await database().doc(COL.TOKEN, token.uid).update({ approved: true, rejected: true });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(memberAddress, updateData);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.setTokenAvailableForSale),
      WenError.token_not_approved.key,
    );
  });

  it('Should throw, not on public sale', async () => {
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(memberAddress, updateData);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.setTokenAvailableForSale),
      WenError.no_token_public_sale.key,
    );
  });

  it('Should throw, not guardian', async () => {
    const random = await testEnv.createMember();
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(random, updateData);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.setTokenAvailableForSale),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should throw, no space', async () => {
    const tokenDocRef = database().doc(COL.TOKEN, token.uid);
    await tokenDocRef.update({
      space: '',
      allocations: JSON.stringify([{ title: 'public', percentage: 100, isPublicSale: true }]),
    });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(memberAddress, updateData);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.setTokenAvailableForSale),
      WenError.token_must_have_space.key,
    );
  });

  it('Should set public availability', async () => {
    await database()
      .doc(COL.TOKEN, token.uid)
      .update({
        allocations: JSON.stringify([{ title: 'public', percentage: 100, isPublicSale: true }]),
      });
    const updateData = {
      token: token.uid,
      ...publicTime,
      autoProcessAt100Percent: true,
      pricePerToken: MIN_IOTA_AMOUNT,
    };
    mockWalletReturnValue(memberAddress, updateData);
    const result = await testEnv.wrap<Token>(WEN_FUNC.setTokenAvailableForSale);
    token = await database().doc(COL.TOKEN, result.uid).get();
    expect(token.uid).toBeDefined();
    expect(token.saleStartDate!.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );
    expect(token.saleLength).toBe(2 * 86400000);
    expect(token.coolDownEnd!.toDate()).toEqual(
      dateToTimestamp(
        dayjs(publicTime.saleStartDate).add(86400000 * 2 + 86400000, 'ms'),
        true,
      ).toDate(),
    );
    expect(token.autoProcessAt100Percent).toBe(true);
  });

  it('Should throw, can not set public availability twice', async () => {
    await database()
      .doc(COL.TOKEN, token.uid)
      .update({
        allocations: JSON.stringify([{ title: 'public', percentage: 100, isPublicSale: true }]),
      });
    mockWalletReturnValue(memberAddress, {
      token: token.uid,
      ...publicTime,
      pricePerToken: MIN_IOTA_AMOUNT,
    });
    await testEnv.wrap(WEN_FUNC.setTokenAvailableForSale);
    mockWalletReturnValue(memberAddress, {
      token: token.uid,
      ...publicTime,
      pricePerToken: MIN_IOTA_AMOUNT,
    });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.setTokenAvailableForSale),
      WenError.public_sale_already_set.key,
    );
  });

  it('Should set no cool down length', async () => {
    const docRef = database().doc(COL.TOKEN, token.uid);
    await docRef.update({
      allocations: JSON.stringify([{ title: 'public', percentage: 100, isPublicSale: true }]),
    });
    const publicTime = {
      saleStartDate: dayjs().toDate(),
      saleLength: 86400000 * 2,
      coolDownLength: 0,
    };
    mockWalletReturnValue(memberAddress, {
      token: token.uid,
      ...publicTime,
      pricePerToken: MIN_IOTA_AMOUNT,
    });
    const result = await testEnv.wrap<Token>(WEN_FUNC.setTokenAvailableForSale);
    token = await database().doc(COL.TOKEN, result.uid).get();
    expect(token.saleStartDate!.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );
    expect(token.saleLength).toBe(publicTime.saleLength);
    expect(token.coolDownEnd!.toDate()).toEqual(
      dateToTimestamp(
        dayjs(publicTime.saleStartDate).add(publicTime.saleLength, 'ms'),
        true,
      ).toDate(),
    );
  });
});
