import dayjs from "dayjs";
import { MIN_IOTA_AMOUNT } from "../../interfaces/config";
import { WenError } from "../../interfaces/errors";
import { WEN_FUNC } from "../../interfaces/functions";
import { Space, Transaction, TransactionOrderType, TransactionType } from "../../interfaces/models";
import { Access, COL, SUB_COL } from "../../interfaces/models/base";
import { Token, TokenAllocation, TokenDistribution, TokenStatus } from "../../interfaces/models/token";
import admin from '../../src/admin.config';
import { joinSpace } from "../../src/controls/space.control";
import { airdropToken, claimAirdroppedToken, createToken, creditToken, orderToken, setTokenAvailableForSale, updateToken } from "../../src/controls/token.control";
import { dateToTimestamp, serverTime } from "../../src/utils/dateTime.utils";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from "../set-up";
import { createMember, createSpace, expectThrow, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, tokenProcessed } from "./common";

const alphabet = "abcdefghijklmnopqrstuvwxyz"
const getRandomSymbol = () => Array.from(Array(4)).map(() => alphabet[Math.floor(Math.random() * alphabet.length)]).join('').toUpperCase()

let walletSpy: any;

const dummyToken = (space: string) => ({
  name: 'MyToken',
  symbol: getRandomSymbol(),
  space,
  pricePerToken: 1 * 1000 * 1000,
  totalSupply: 1000,
  allocations: <TokenAllocation[]>[{ title: 'Allocation1', percentage: 100 }],
  icon: 'icon',
  overviewGraphics: 'overviewGraphics',
  termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
  access: 0
}) as any

const submitTokenOrderFunc = async <T>(spy: string, address: string, params: T) => {
  mockWalletReturnValue(spy, address, params);
  const order = await testEnv.wrap(orderToken)({});
  expect(order?.createdOn).toBeDefined();
  return order;
}

const submitCreditTokenFunc = async <T>(spy: string, address: string, params: T) => {
  mockWalletReturnValue(spy, address, params);
  const order = await testEnv.wrap(creditToken)({});
  expect(order?.createdOn).toBeDefined();
  return order;
}

describe('Token controller: ' + WEN_FUNC.cToken, () => {
  let memberAddress: string;
  let space: Space;
  let token: any

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy)
    space = await createSpace(walletSpy, memberAddress, true)
    token = dummyToken(space.uid)
  });

  it('Should create token', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token)
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
  })

  it('Should create, one public sale', async () => {
    token.allocations = [{ title: 'asd', percentage: 100, isPublicSale: true }]
    const saleStartDate = dayjs().add(8, 'day')
    token.saleStartDate = saleStartDate.toDate()
    token.saleLength = 86400000
    token.coolDownLength = 86400000
    mockWalletReturnValue(walletSpy, memberAddress, token)
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(dateToTimestamp(saleStartDate, true).toDate())
    expect(result?.saleLength).toBe(86400000)
    expect(result?.coolDownEnd.toDate()).toEqual(dateToTimestamp(dayjs(saleStartDate).add(token.saleLength + token.coolDownLength, 'ms'), true).toDate())
  })

  it('Should not allow two tokens', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await testEnv.wrap(createToken)({});
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid))
    await expectThrow(testEnv.wrap(createToken)({}), WenError.token_already_exists_for_space.key)
  })

  it('Should only allow two tokens if first rejected', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token)
    const cToken = await testEnv.wrap(createToken)({});
    await admin.firestore().doc(`${COL.TOKEN}/${cToken.uid}`).update({ approved: false, rejected: true })
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid))
    const secondToken = await testEnv.wrap(createToken)({});
    expect(secondToken.uid).toBeDefined()
  })

  it('Should throw, no name', async () => {
    delete token.name
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, no terms and conditions', async () => {
    delete token.termsAndConditions
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, no symbol', async () => {
    delete token.symbol
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, no space', async () => {
    delete token.space
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, no valid space address', async () => {
    space = await createSpace(walletSpy, memberAddress)
    token.space = space.uid
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.space_must_have_validated_address.key)
  })

  it('Should throw, no pricePerToken', async () => {
    delete token.pricePerToken
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, no totalSupply', async () => {
    delete token.totalSupply
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, no allocations', async () => {
    delete token.allocations
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, wrong total percentage', async () => {
    token.allocations = [{ title: 'asd', percentage: 50 }, { title: 'ccc', percentage: 40 }]
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, more then one public sale', async () => {
    token.allocations = [{ title: 'asd', percentage: 50, isPublicSale: true }, { title: 'ccc', percentage: 50, isPublicSale: true }]
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, past start date', async () => {
    token.startDate = dayjs().subtract(1, 'd').toDate()
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, creator is not guardian', async () => {
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.you_are_not_guardian_of_space.key)
  })

  it('Should create with public sale but no date', async () => {
    const token: any = dummyToken(space.uid)
    token.allocations = [{ title: 'asd', percentage: 100, isPublicSale: true }]
    mockWalletReturnValue(walletSpy, memberAddress, token)
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
  })

  it('Should throw, no public sale', async () => {
    const token: any = dummyToken(space.uid)
    token.saleStartDate = dayjs().add(8, 'd').toDate()
    token.saleLength = 86400000;
    token.coolDownLength = 86400000;
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.no_token_public_sale.key)
  })

  it('Should throw, when public sale data is incomplete', async () => {
    const token: any = dummyToken(space.uid)
    token.allocations = [{ title: 'asd', percentage: 100, isPublicSale: true }]

    token.saleStartDate = dayjs().add(8, 'd').toDate()
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)

    token.saleLength = 86400000
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)

    token.coolDownLength = 86400000
    mockWalletReturnValue(walletSpy, memberAddress, token)
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
  })

  it('Should throw, token symbol not unique', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await testEnv.wrap(createToken)({})
    const space = await createSpace(walletSpy, memberAddress)
    const data = dummyToken(space.uid)
    mockWalletReturnValue(walletSpy, memberAddress, { ...data, symbol: token.symbol })
    await expectThrow(testEnv.wrap(createToken)({}), WenError.token_symbol_must_be_globally_unique.key)
  })

  it('Should throw, space does not exist', async () => {
    token.space = wallet.getRandomEthAddress()
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.you_are_not_guardian_of_space.key)
  })

  it('Should create with short description', async () => {
    token.shortDescriptionTitle = 'shortDescriptionTitle'
    token.shortDescription = 'shortDescription'
    mockWalletReturnValue(walletSpy, memberAddress, token)
    const result = await testEnv.wrap(createToken)({})
    expect(result.shortDescriptionTitle).toBe('shortDescriptionTitle')
    expect(result.shortDescription).toBe('shortDescription')
  })

  it('Should throw, accessAwards required if access is MEMBERS_WITH_BADGE', async () => {
    token.access = Access.MEMBERS_WITH_BADGE
    token.accessAwards = [wallet.getRandomEthAddress()]
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await testEnv.wrap(createToken)({})
    token.accessAwards = []
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, accessCollections required if access is MEMBERS_WITH_NFT_FROM_COLLECTION', async () => {
    token.access = Access.MEMBERS_WITH_NFT_FROM_COLLECTION
    token.accessCollections = [wallet.getRandomEthAddress()]
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await testEnv.wrap(createToken)({})
    token.accessCollections = []
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)
  })
})

describe('Token controller: ' + WEN_FUNC.uToken, () => {
  let memberAddress: string;
  let space: Space;
  let token: any

  const data = ({ shortDescriptionTitle: null, shortDescription: null, name: null, uid: null, title: null, description: null })

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy)
    space = await createSpace(walletSpy, memberAddress, true)
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid))
    token = await testEnv.wrap(createToken)({});
  });

  it('Should update token', async () => {
    const updateData = { ...data, name: 'TokenName2', uid: token.uid, title: 'title', description: 'description' }
    mockWalletReturnValue(walletSpy, memberAddress, updateData)
    const result = await testEnv.wrap(updateToken)({});
    expect(result.name).toBe(updateData.name)
    expect(result.title).toBe(updateData.title)
    expect(result.description).toBe(updateData.description)
  })

  it('Should update token - remove description', async () => {
    const updateData = { ...data, name: token.name, uid: token.uid, title: 'title2', }
    mockWalletReturnValue(walletSpy, memberAddress, updateData)
    const result = await testEnv.wrap(updateToken)({});
    expect(result.name).toBe(token.name)
    expect(result.title).toBe(updateData.title)
    expect(result.description).toBe(updateData.description)
  })

  it('Should throw, not owner ', async () => {
    const updateData = { ...data, name: 'TokenName2', uid: token.uid, title: 'title', description: 'description' }
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), updateData)
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.you_are_not_guardian_of_space.key)
  })

  it('Should update short description', async () => {
    const updateData = { ...data, uid: token.uid, shortDescriptionTitle: 'shortDescriptionTitle', shortDescription: 'shortDescription' }
    mockWalletReturnValue(walletSpy, memberAddress, updateData)
    const result = await testEnv.wrap(updateToken)({});
    expect(result.shortDescriptionTitle).toBe('shortDescriptionTitle')
    expect(result.shortDescription).toBe('shortDescription')
  })

})

describe('Token controller: ' + WEN_FUNC.setTokenAvailableForSale, () => {
  let memberAddress: string;
  let space: Space;
  let token: any
  let publicTime = { saleStartDate: dayjs().toDate(), saleLength: 86400000 * 2, coolDownLength: 86400000 }

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy)
    space = await createSpace(walletSpy, memberAddress, true)
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid))
    token = await testEnv.wrap(createToken)({});
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true })
  });

  it('Should throw, not approved', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false })
    const updateData = { token: token.uid, ...publicTime }
    mockWalletReturnValue(walletSpy, memberAddress, updateData)
    await expectThrow(testEnv.wrap(setTokenAvailableForSale)({}), WenError.token_not_approved.key);
  })

  it('Should throw, rejected', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true, rejected: true })
    const updateData = { token: token.uid, ...publicTime }
    mockWalletReturnValue(walletSpy, memberAddress, updateData)
    await expectThrow(testEnv.wrap(setTokenAvailableForSale)({}), WenError.token_not_approved.key);
  })

  it('Should throw, not on public sale', async () => {
    const updateData = { token: token.uid, ...publicTime }
    mockWalletReturnValue(walletSpy, memberAddress, updateData)
    await expectThrow(testEnv.wrap(setTokenAvailableForSale)({}), WenError.no_token_public_sale.key);
  })

  it('Should throw, not guardian', async () => {
    const updateData = { token: token.uid, ...publicTime }
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), updateData)
    await expectThrow(testEnv.wrap(setTokenAvailableForSale)({}), WenError.you_are_not_guardian_of_space.key);
  })

  it('Should set public availability', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] })
    const updateData = { token: token.uid, ...publicTime }
    mockWalletReturnValue(walletSpy, memberAddress, updateData)
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate())
    expect(result?.saleLength).toBe(2 * 86400000)
    expect(result?.coolDownEnd.toDate()).toEqual(dateToTimestamp(dayjs(publicTime.saleStartDate).add(86400000 * 2 + 86400000, 'ms'), true).toDate())
  })

  it('Should throw, can not set public availability twice', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] })
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, ...publicTime })
    await testEnv.wrap(setTokenAvailableForSale)({});

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, ...publicTime })
    await expectThrow(testEnv.wrap(setTokenAvailableForSale)({}), WenError.public_sale_already_set.key);
  })

})

describe("Token controller: " + WEN_FUNC.orderToken, () => {
  let memberAddress: string;
  let space: Space;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy, true)
    space = await createSpace(walletSpy, memberAddress, true)

    const tokenId = wallet.getRandomEthAddress()
    token = ({
      symbol: 'MYWO',
      totalSupply: 1000,
      approved: true,
      rejected: false,
      icon: 'icon',
      overviewGraphics: 'overviewGraphics',
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space: space.uid,
      uid: tokenId,
      pricePerToken: MIN_IOTA_AMOUNT,
      allocations: [
        { title: 'Public sale', isPublicSale: true, percentage: 50 },
        { title: 'Private', percentage: 50 }
      ],
      createdBy: memberAddress,
      name: 'MyToken',
      wenUrl: 'https://wen.soonaverse.com/token/' + tokenId,
      saleLength: 86400000 * 2,
      saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
      links: [],
      status: TokenStatus.AVAILABLE,
      totalDeposit: 0,
      totalAirdropped: 0,
      termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
      access: 0
    })
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  });

  it('Should create token order', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const distribution = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()).data()
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT)
  })

  it('Should order more token', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const order2 = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone2 = await submitMilestoneFunc(order2.payload.targetAddress, order2.payload.amount);
    await milestoneProcessed(nextMilestone2.milestone, nextMilestone2.tranId);

    const distribution = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()).data()
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT * 2)
  })

  it('Should create token order and should credit some amount', async () => {
    for (const _ of [0, 1]) {
      const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
      const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
    }

    const distribution = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()).data()
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT * 2)

    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({
      saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
      coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate())
    });

    await submitCreditTokenFunc(walletSpy, memberAddress, { token: token.uid, amount: MIN_IOTA_AMOUNT });

    const updatedDistribution = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()).data()
    expect(updatedDistribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT)

    const updatedToken = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
    expect(updatedToken?.totalDeposit).toBe(MIN_IOTA_AMOUNT)
  })

  it('Should create token order and should credit all amount', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const distribution = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()).data()
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT)

    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({
      saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
      coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate())
    });

    await submitCreditTokenFunc(walletSpy, memberAddress, { token: token.uid, amount: MIN_IOTA_AMOUNT });

    const updatedDistribution = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()).data()
    expect(updatedDistribution?.totalDeposit).toBe(0)

    const updatedToken = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
    expect(updatedToken?.totalDeposit).toBe(0)
  })

  it('Should create token order and should fail credit, not in cool down period', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({
      saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
      coolDownEnd: dateToTimestamp(dayjs().subtract(1, 'm').toDate())
    });

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, amount: MIN_IOTA_AMOUNT });
    await expectThrow(testEnv.wrap(creditToken)({}), WenError.token_not_in_cool_down_period.key)
  })

  it('Should throw, amount too much to refund', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const distribution = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()).data()
    expect(distribution?.totalDeposit).toBe(token.pricePerToken)

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, amount: MIN_IOTA_AMOUNT * 4 });
    await expectThrow(testEnv.wrap(creditToken)({}), WenError.not_enough_funds.key)
  })

  it('Should throw, amount too much to refund after second credit', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({
      saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
      coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate())
    });

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, amount: token.pricePerToken });
    await testEnv.wrap(creditToken)({})

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, amount: token.pricePerToken });
    await expectThrow(testEnv.wrap(creditToken)({}), WenError.not_enough_funds.key)
  })

  it('Should allow only for members', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ access: Access.MEMBERS_ONLY })
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    await testEnv.wrap(orderToken)({});
    const newMember = await createMember(walletSpy, true)
    mockWalletReturnValue(walletSpy, newMember, { token: token.uid });
    await expectThrow(testEnv.wrap(orderToken)({}), WenError.you_are_not_part_of_space.key);
  })

  it('Should allow only for guardians', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ access: Access.GUARDIANS_ONLY })

    const newMember = await createMember(walletSpy, true)
    mockWalletReturnValue(walletSpy, newMember, { uid: space.uid })
    await testEnv.wrap(joinSpace)({});

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    await testEnv.wrap(orderToken)({});

    mockWalletReturnValue(walletSpy, newMember, { token: token.uid });
    await expectThrow(testEnv.wrap(orderToken)({}), WenError.you_are_not_guardian_of_space.key);
  })

  it('Should throw, no badge so can not access', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ access: Access.MEMBERS_WITH_BADGE, accessAwards: [wallet.getRandomEthAddress()] })
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    await expectThrow(testEnv.wrap(orderToken)({}), WenError.you_dont_have_required_badge.key);
  })

  it('Should throw, no nft so can not access', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ access: Access.MEMBERS_WITH_NFT_FROM_COLLECTION, accessCollections: [wallet.getRandomEthAddress()] })
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    await expectThrow(testEnv.wrap(orderToken)({}), WenError.you_dont_have_required_NFTs.key);
  })

  it('Should create token order and should credit, not leave less then MIN amount', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, 1.5 * MIN_IOTA_AMOUNT);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const distribution = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()).data()
    expect(distribution?.totalDeposit).toBe(1.5 * MIN_IOTA_AMOUNT)

    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({
      saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
      coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate())
    });

    const credit = await submitCreditTokenFunc(walletSpy, memberAddress, { token: token.uid, amount: MIN_IOTA_AMOUNT });
    expect(credit.payload.amount).toBe(1.5 * MIN_IOTA_AMOUNT)
  })

  it('Should create order in parallel', async () => {
    const promises = [submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid }), submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid })]
    const orders = await Promise.all(promises)
    expect(orders[0]).toEqual(orders[1])
  })

  it('Should create order and deposit in parallel', async () => {
    const array = Array.from(Array(1000))
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const amounts = array.map((_, index) => index * MIN_IOTA_AMOUNT)
    const total = array.reduce((sum, _, index) => sum + (index * MIN_IOTA_AMOUNT), 0)
    const deposit = async (amount: number) => {
      const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, amount);
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
    }
    const promises = amounts.map(deposit)
    await Promise.all(promises)
    const distribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()).data()
    expect(distribution.totalDeposit).toBe(total)
  })

})

describe('Token airdrop test', () => {
  let guardianAddress: string;
  let memberAddress: string;
  let space: Space;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardianAddress = await createMember(walletSpy)
    space = await createSpace(walletSpy, guardianAddress, true)
    const dummyTokenData = dummyToken(space.uid)
    dummyTokenData.saleStartDate = dayjs().add(8, 'day').toDate()
    dummyTokenData.saleLength = 86400000
    dummyTokenData.coolDownLength = 86400000
    dummyTokenData.allocations = [{ title: 'Private', percentage: 90 }, { title: 'Public', percentage: 10, isPublicSale: true }]
    mockWalletReturnValue(walletSpy, guardianAddress, dummyTokenData)
    token = await testEnv.wrap(createToken)({});
    memberAddress = await createMember(walletSpy)
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true })
  });

  it('Should fail, token not approved', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false })
    const airdropRequest = { token: token.uid, drops: [{ count: 900, recipient: guardianAddress, vestingAt: dayjs().toDate() }] }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest)
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.token_not_approved.key)
  })

  it('Should airdrop token', async () => {
    const vestingAt = dayjs().toDate()
    const airdropRequest = { token: token.uid, drops: [{ count: 900, recipient: guardianAddress, vestingAt }] }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest)
    const airdrops = await testEnv.wrap(airdropToken)({});
    expect(airdrops.length).toBe(1)
    expect(airdrops[0].tokenDrops.map((d: any) => { delete d.uid; return d })).toEqual([{ count: 900, vestingAt: dateToTimestamp(vestingAt) }])
    expect(airdrops[0].uid).toBe(guardianAddress)
  })

  it('Should airdrop batch token', async () => {
    const vestingAt = dayjs().toDate()
    const airdropRequest = {
      token: token.uid, drops: [{ count: 800, recipient: guardianAddress, vestingAt }, { count: 100, recipient: memberAddress, vestingAt }]
    }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest)
    const airdrops = await testEnv.wrap(airdropToken)({});
    expect(airdrops.length).toBe(2)
    expect(airdrops[0].tokenDrops.map((d: any) => { delete d.uid; return d })).toEqual([{ count: 800, vestingAt: dateToTimestamp(vestingAt) }])
    expect(airdrops[0].uid).toBe(guardianAddress)
    expect(airdrops[1].tokenDrops.map((d: any) => { delete d.uid; return d })).toEqual([{ count: 100, vestingAt: dateToTimestamp(vestingAt) }])
    expect(airdrops[1].uid).toBe(memberAddress)
  })

  it('Should throw, not enough tokens', async () => {
    const airdropRequest = { token: token.uid, drops: [{ count: 1000, recipient: guardianAddress, vestingAt: dayjs().toDate() }] }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest)
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.no_tokens_available_for_airdrop.key)
  })

  it('Should throw, no vesting', async () => {
    const airdropRequest = { token: token.uid, drops: [{ count: 1000, recipient: guardianAddress, }] }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest)
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.invalid_params.key)
  })

  it('Should throw, not guardian', async () => {
    const airdropRequest = { token: token.uid, drops: [{ count: 50, recipient: guardianAddress, vestingAt: dayjs().toDate() }] }
    mockWalletReturnValue(walletSpy, memberAddress, airdropRequest)
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.you_are_not_guardian_of_space.key)
  })

  it('Should throw at second drop', async () => {
    const vestingAt = dayjs().toDate()
    const airdropRequest = { token: token.uid, drops: [{ count: 900, recipient: guardianAddress, vestingAt }] }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest)
    const airdrops = await testEnv.wrap(airdropToken)({});
    expect(airdrops[0].tokenDrops.map((d: any) => { delete d.uid; return d })).toEqual([{ count: 900, vestingAt: dateToTimestamp(vestingAt) }])
    expect(airdrops[0].uid).toBe(guardianAddress)

    const airdropRequest2 = { token: token.uid, drops: [{ count: 100, recipient: guardianAddress, vestingAt: dayjs().toDate() }] }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest2)
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.no_tokens_available_for_airdrop.key)
  })

  it('Should drop multiple for same user', async () => {
    const vestingAt = dayjs().toDate()
    const airdropRequest = {
      token: token.uid, drops: [{ count: 400, recipient: guardianAddress, vestingAt }, { count: 50, recipient: memberAddress, vestingAt }]
    }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest)
    await testEnv.wrap(airdropToken)({});
    await testEnv.wrap(airdropToken)({});

    const guardDistribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardianAddress}`).get()).data()
    expect(guardDistribution.tokenDrops?.length).toBe(2)
  })
})

describe('Claim airdropped token test', () => {
  let guardianAddress: string;
  let space: Space;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardianAddress = await createMember(walletSpy, true)
    space = await createSpace(walletSpy, guardianAddress, true)
    const dummyTokenData = dummyToken(space.uid)
    dummyTokenData.saleStartDate = dayjs().add(8, 'day').toDate()
    dummyTokenData.saleLength = 86400000
    dummyTokenData.coolDownLength = 86400000
    dummyTokenData.allocations = [{ title: 'Private', percentage: 90 }, { title: 'Public', percentage: 10, isPublicSale: true }]
    mockWalletReturnValue(walletSpy, guardianAddress, dummyTokenData)
    token = await testEnv.wrap(createToken)({});
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true })

    const airdropRequest = { token: token.uid, drops: [{ count: 450, recipient: guardianAddress, vestingAt: dayjs().toDate() }], }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest)
    await testEnv.wrap(airdropToken)({});
  });

  it('Should claim token', async () => {
    mockWalletReturnValue(walletSpy, guardianAddress, { token: token.uid })
    const order = await testEnv.wrap(claimAirdroppedToken)({});
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const orderTran = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data();
    expect(orderTran.member).toBe(guardianAddress)
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP)

    const paymentsSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid).get()
    const types = paymentsSnap.docs.map(d => d.data().type).sort()
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT])

    const airdrop = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardianAddress}`).get()).data()
    expect(airdrop?.tokenDrops.length).toBe(0)
    expect(airdrop?.tokenClaimed).toBe(450)
    expect(airdrop?.tokenOwned).toBe(450)
  })

  it('Should claim multiple drops token', async () => {
    const airdropRequest = { token: token.uid, drops: [{ count: 450, recipient: guardianAddress, vestingAt: dayjs().toDate() }], }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest)
    await testEnv.wrap(airdropToken)({});

    mockWalletReturnValue(walletSpy, guardianAddress, { token: token.uid })
    const order = await testEnv.wrap(claimAirdroppedToken)({});
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const orderTran = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data();
    expect(orderTran.member).toBe(guardianAddress)
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP)

    const paymentsSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid).get()
    const types = paymentsSnap.docs.map(d => d.data().type).sort()
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT])

    const airdrop = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardianAddress}`).get()).data()
    expect(airdrop?.tokenDrops.length).toBe(0)
    expect(airdrop?.tokenClaimed).toBe(900)
    expect(airdrop?.tokenOwned).toBe(900)
  })

  it('Should claim only vested drops', async () => {
    const airdropRequest = { token: token.uid, drops: [{ count: 450, recipient: guardianAddress, vestingAt: dayjs().add(1, 'd').toDate() }], }
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest)
    await testEnv.wrap(airdropToken)({});

    mockWalletReturnValue(walletSpy, guardianAddress, { token: token.uid })
    const order = await testEnv.wrap(claimAirdroppedToken)({});
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const orderTran = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data();
    expect(orderTran.member).toBe(guardianAddress)
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP)

    const paymentsSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid).get()
    const types = paymentsSnap.docs.map(d => d.data().type).sort()
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT])

    const airdrop = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardianAddress}`).get()).data()
    expect(airdrop?.tokenDrops.length).toBe(1)
    expect(airdrop?.tokenClaimed).toBe(450)
    expect(airdrop?.tokenOwned).toBe(450)
  })

  it('Should claim same in parallel', async () => {
    mockWalletReturnValue(walletSpy, guardianAddress, { token: token.uid })
    const claimToken = async () => {
      const order = await testEnv.wrap(claimAirdroppedToken)({});
      await new Promise((r) => setTimeout(r, 1000));
      const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
      return order
    }
    const promises = [claimToken(), claimToken()]
    await Promise.all(promises)

    const distribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardianAddress}`).get()).data()
    expect(distribution.tokenDrops?.length).toBe(0)
    expect(distribution.tokenClaimed).toBe(450)
    expect(distribution.tokenOwned).toBe(450)

    const creditSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', guardianAddress)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload.token', '==', token.uid)
      .get()
    expect(creditSnap.size).toBe(1)

    const billPaymentSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', guardianAddress)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.token', '==', token.uid)
      .get()
    expect(billPaymentSnap.size).toBe(1)
  })

})

describe('Order and claim airdropped token test', () => {
  let memberAddress: string;
  let space: Space;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy, true)
    space = await createSpace(walletSpy, memberAddress, true)

    const tokenId = wallet.getRandomEthAddress()
    token = ({
      symbol: 'MYWO',
      totalSupply: 10,
      approved: true,
      rejected: false,
      icon: 'icon',
      overviewGraphics: 'overviewGraphics',
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space: space.uid,
      uid: tokenId,
      pricePerToken: MIN_IOTA_AMOUNT,
      allocations: [
        { title: 'Public sale', isPublicSale: true, percentage: 50 },
        { title: 'Private', percentage: 50 }
      ],
      createdBy: memberAddress,
      name: 'MyToken',
      wenUrl: 'https://wen.soonaverse.com/token/' + tokenId,
      saleLength: 86400000 * 2,
      saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
      links: [],
      status: TokenStatus.AVAILABLE,
      totalDeposit: 0,
      totalAirdropped: 0,
      termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
      access: 0
    })
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);

    const airdropRequest = { token: token.uid, drops: [{ count: 5, recipient: memberAddress, vestingAt: dayjs().toDate() }], }
    mockWalletReturnValue(walletSpy, memberAddress, airdropRequest)
    await testEnv.wrap(airdropToken)({});
  });

  it('Should order and claim dropped', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, 5 * token.pricePerToken);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    const claimOrder = await testEnv.wrap(claimAirdroppedToken)({});
    const claimNxtMilestone = await submitMilestoneFunc(claimOrder.payload.targetAddress, claimOrder.payload.amount);
    await milestoneProcessed(claimNxtMilestone.milestone, claimNxtMilestone.tranId);

    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.PROCESSING });
    await tokenProcessed(token.uid, 1, true)

    const distribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()).data();
    expect(distribution.tokenClaimed).toBe(5)
    expect(distribution.totalPaid).toBe(5 * token.pricePerToken)
    expect(distribution.tokenOwned).toBe(10)
  })
})

