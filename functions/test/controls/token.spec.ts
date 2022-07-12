import dayjs from "dayjs";
import { MIN_IOTA_AMOUNT } from "../../interfaces/config";
import { WenError } from "../../interfaces/errors";
import { WEN_FUNC } from "../../interfaces/functions";
import { Space, Transaction, TransactionCreditType, TransactionOrderType, TransactionType } from "../../interfaces/models";
import { Access, COL, SUB_COL } from "../../interfaces/models/base";
import { Token, TokenAllocation, TokenDistribution, TokenStatus } from "../../interfaces/models/token";
import admin from '../../src/admin.config';
import { airdropToken, cancelPublicSale, claimAirdroppedToken, createToken, orderToken, setTokenAvailableForSale, updateToken } from "../../src/controls/token.control";
import { dateToTimestamp, serverTime } from "../../src/utils/dateTime.utils";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from "../set-up";
import { createMember, createSpace, expectThrow, getRandomSymbol, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, tokenProcessed, wait } from "./common";

let walletSpy: any;

const dummyToken = (space: string) => ({
  name: 'MyToken',
  symbol: getRandomSymbol(),
  space,
  pricePerToken: MIN_IOTA_AMOUNT,
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

describe('Token controller: ' + WEN_FUNC.cToken, () => {
  let memberAddress: string;
  let space: Space;
  let token: any

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy)
    space = await createSpace(walletSpy, memberAddress)
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
    token.autoProcessAt100Percent = true
    mockWalletReturnValue(walletSpy, memberAddress, token)
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(dateToTimestamp(saleStartDate, true).toDate())
    expect(result?.saleLength).toBe(86400000)
    expect(result?.coolDownEnd.toDate()).toEqual(dateToTimestamp(dayjs(saleStartDate).add(token.saleLength + token.coolDownLength, 'ms'), true).toDate())
    expect(result?.autoProcessAt100Percent).toBe(true)
  })

  it('Should create, one public sale, no cooldown period', async () => {
    token.allocations = [{ title: 'asd', percentage: 100, isPublicSale: true }]
    const saleStartDate = dayjs().add(8, 'day')
    token.saleStartDate = saleStartDate.toDate()
    token.saleLength = 86400000
    token.coolDownLength = 0
    mockWalletReturnValue(walletSpy, memberAddress, token)
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(dateToTimestamp(saleStartDate, true).toDate())
    expect(result?.saleLength).toBe(86400000)
    expect(result?.coolDownEnd.toDate()).toEqual(dateToTimestamp(dayjs(saleStartDate).add(token.saleLength, 'ms'), true).toDate())
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
    space = await createSpace(walletSpy, memberAddress)
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
    space = await createSpace(walletSpy, memberAddress)
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
    expect(result?.autoProcessAt100Percent).toBe(false)
  })

  it('Should set public availability', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] })
    const updateData = { token: token.uid, ...publicTime, autoProcessAt100Percent: true }
    mockWalletReturnValue(walletSpy, memberAddress, updateData)
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate())
    expect(result?.saleLength).toBe(2 * 86400000)
    expect(result?.coolDownEnd.toDate()).toEqual(dateToTimestamp(dayjs(publicTime.saleStartDate).add(86400000 * 2 + 86400000, 'ms'), true).toDate())
    expect(result?.autoProcessAt100Percent).toBe(true)
  })

  it('Should throw, can not set public availability twice', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] })
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, ...publicTime })
    await testEnv.wrap(setTokenAvailableForSale)({});

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, ...publicTime })
    await expectThrow(testEnv.wrap(setTokenAvailableForSale)({}), WenError.public_sale_already_set.key);
  })

  it('Should set no cool down length', async () => {
    const docRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`)
    await docRef.update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] })
    const publicTime = { saleStartDate: dayjs().toDate(), saleLength: 86400000 * 2, coolDownLength: 0 }
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, ...publicTime })
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.saleStartDate.toDate()).toEqual(dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate())
    expect(result?.saleLength).toBe(publicTime.saleLength)
    expect(result?.coolDownEnd.toDate()).toEqual(dateToTimestamp(dayjs(publicTime.saleStartDate).add(publicTime.saleLength, 'ms'), true).toDate())
  })

})

const setAvailableOrderAndCancelSale = async (token: Token, memberAddress: string, miotas: number) => {
  const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`)
  const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
  await tokenDocRef.update({
    saleLength: 86400000 * 2,
    saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
    coolDownEnd: dateToTimestamp(dayjs().subtract(1, 'd').add(86400000 * 2, 'ms').toDate()),
  });
  const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
  const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, miotas * MIN_IOTA_AMOUNT);
  await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

  const distribution = <TokenDistribution>(await distributionDocRef.get()).data()
  expect(distribution.totalDeposit).toBe(miotas * MIN_IOTA_AMOUNT)

  mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
  await testEnv.wrap(cancelPublicSale)({});
  await wait(async () => (await tokenDocRef.get()).data()?.status === TokenStatus.AVAILABLE)
  const tokenData = <Token>(await tokenDocRef.get()).data()
  expect(tokenData.saleStartDate).toBeUndefined()
}

describe('Token controller: ' + WEN_FUNC.cancelPublicSale, () => {
  let memberAddress: string;
  let space: Space;
  let token: any

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy)
    space = await createSpace(walletSpy, memberAddress)
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
      links: [],
      status: TokenStatus.AVAILABLE,
      totalDeposit: 0,
      totalAirdropped: 0,
      termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
      access: 0
    })
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  });

  it('Should cancel public sale and refund buyers twice', async () => {
    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
    await setAvailableOrderAndCancelSale(token, memberAddress, 5);
    await setAvailableOrderAndCancelSale(token, memberAddress, 6);
    const distribution = <TokenDistribution>(await distributionDocRef.get()).data()
    expect(distribution.totalDeposit).toBe(0)
    const creditDocs = (await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload.type', '==', TransactionCreditType.TOKEN_PURCHASE)
      .where('member', '==', memberAddress)
      .get()).docs
    expect(creditDocs.map(d => d.data()?.payload?.amount).sort((a, b) => a - b)).toEqual([5 * MIN_IOTA_AMOUNT, 6 * MIN_IOTA_AMOUNT])
  })

  it('Should cancel public sale and refund buyers twice, then finish sale', async () => {
    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
    await setAvailableOrderAndCancelSale(token, memberAddress, 5);
    await setAvailableOrderAndCancelSale(token, memberAddress, 6);
    let distribution = <TokenDistribution>(await distributionDocRef.get()).data()
    expect(distribution.totalDeposit).toBe(0)
    const creditDocs = (await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload.type', '==', TransactionCreditType.TOKEN_PURCHASE)
      .where('member', '==', memberAddress)
      .get()).docs
    expect(creditDocs.map(d => d.data()?.payload?.amount).sort((a, b) => a - b)).toEqual([5 * MIN_IOTA_AMOUNT, 6 * MIN_IOTA_AMOUNT])

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`)
    await tokenDocRef.update({
      saleLength: 86400000 * 2,
      saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
      coolDownEnd: dateToTimestamp(dayjs().subtract(1, 'd').add(86400000 * 2, 'ms').toDate()),
    });
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, 7 * MIN_IOTA_AMOUNT);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    await tokenDocRef.update({ status: TokenStatus.PROCESSING })
    await wait(async () => (await tokenDocRef.get()).data()?.status === TokenStatus.PRE_MINTED)

    distribution = <TokenDistribution>(await distributionDocRef.get()).data()
    expect(distribution.totalPaid).toBe(5 * MIN_IOTA_AMOUNT)
    expect(distribution.refundedAmount).toBe(2 * MIN_IOTA_AMOUNT)
    expect(distribution.tokenOwned).toBe(5)
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
    space = await createSpace(walletSpy, guardianAddress)
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
    guardianAddress = await createMember(walletSpy)
    space = await createSpace(walletSpy, guardianAddress)
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
    memberAddress = await createMember(walletSpy)
    space = await createSpace(walletSpy, memberAddress)

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

