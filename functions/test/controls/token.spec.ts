import dayjs from "dayjs";
import * as admin from 'firebase-admin';
import { MIN_IOTA_AMOUNT } from "../../interfaces/config";
import { WenError } from "../../interfaces/errors";
import { WEN_FUNC } from "../../interfaces/functions";
import { Member, Space } from "../../interfaces/models";
import { COL, SUB_COL } from "../../interfaces/models/base";
import { Token, TokenStatus } from "../../interfaces/models/token";
import { createMember } from "../../src/controls/member.control";
import { createSpace } from "../../src/controls/space.control";
import { createToken, creditToken, orderToken, updateToken } from "../../src/controls/token.control";
import { dateToTimestamp, serverTime } from "../../src/utils/dateTime.utils";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from "../set-up";
import { expectThrow, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, validateMemberAddressFunc, validateSpaceAddressFunc } from "./common";

const alphabet = "abcdefghijklmnopqrstuvwxyz"
const getRandomSymbol = () => Array.from(Array(4)).map(() => alphabet[Math.floor(Math.random() * alphabet.length)]).join('').toUpperCase()

let walletSpy: any;

const dummyToken = (space: string) => ({
  name: 'MyToken',
  symbol: getRandomSymbol(),
  space,
  pricePerToken: 1 * 1000 * 1000,
  totalSupply: 1000,
  allocations: [{ title: 'Allocation1', percentage: 100 }],
  icon: 'icon',
  overviewGraphics: 'overviewGraphics'
})

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
    memberAddress = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, memberAddress, {})
    await testEnv.wrap(createMember)(memberAddress);
    mockWalletReturnValue(walletSpy, memberAddress, { name: 'Space A' })
    space = await testEnv.wrap(createSpace)({});
    token = dummyToken(space.uid)
  });

  it('Should create token', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token)
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
  })

  it('Should create, one public sale', async () => {
    token.allocations = [{ title: 'asd', percentage: 100, isPublicSale: true }]
    token.saleStartDate = dayjs().add(8, 'day').toDate()
    token.saleLength = 86400000
    mockWalletReturnValue(walletSpy, memberAddress, token)
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate).toBeDefined()
    expect(result?.saleLength).toBeDefined()
    expect(result?.coolDownEnd).toBeDefined()
  })

  it('Should not allow two tokens', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await testEnv.wrap(createToken)({});
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid))
    await expectThrow(testEnv.wrap(createToken)({}), WenError.token_already_exists_for_space.key)
  })

  it('Should throw, no name', async () => {
    delete token.name
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

  it('Should throw, saleStartDate requite', async () => {
    const allocations = [{ title: 'asd', percentage: 100, isPublicSale: true }]
    token.allocations = allocations
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key)

    const correctData = ({ ...dummyToken(space.uid), saleStartDate: dayjs().add(8, 'd').toDate(), saleLength: 240000, allocations })
    mockWalletReturnValue(walletSpy, memberAddress, correctData)
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
  })

  it('Should throw, token symbol not unique', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await testEnv.wrap(createToken)({})

    mockWalletReturnValue(walletSpy, memberAddress, { name: 'Space B' })
    const space = await testEnv.wrap(createSpace)({});
    const data = dummyToken(space.uid)
    mockWalletReturnValue(walletSpy, memberAddress, { ...data, symbol: token.symbol })
    await expectThrow(testEnv.wrap(createToken)({}), WenError.token_symbol_must_be_globally_unique.key)
  })

  it('Should throw, space does not exist', async () => {
    token.space = wallet.getRandomEthAddress()
    mockWalletReturnValue(walletSpy, memberAddress, token)
    await expectThrow(testEnv.wrap(createToken)({}), WenError.you_are_not_guardian_of_space.key)
  })
})

describe('Token controller: ' + WEN_FUNC.uToken, () => {
  let memberAddress: string;
  let space: Space;
  let token: any

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, memberAddress, {})
    await testEnv.wrap(createMember)(memberAddress);
    mockWalletReturnValue(walletSpy, memberAddress, { name: 'Space A' })
    space = await testEnv.wrap(createSpace)({});
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid))
    token = await testEnv.wrap(createToken)({});
  });

  it('Should update token', async () => {
    const updateData = { name: 'TokenName2', uid: token.uid, title: 'title', description: 'description' }
    mockWalletReturnValue(walletSpy, memberAddress, updateData)
    const result = await testEnv.wrap(updateToken)({});
    expect(result.name).toBe(updateData.name)
    expect(result.title).toBe(updateData.title)
    expect(result.description).toBe(updateData.description)
  })

  it('Should update token - remove description', async () => {
    const updateData = { name: token.name, uid: token.uid, title: 'title2', description: null }
    mockWalletReturnValue(walletSpy, memberAddress, updateData)
    const result = await testEnv.wrap(updateToken)({});
    expect(result.name).toBe(token.name)
    expect(result.title).toBe(updateData.title)
    expect(result.description).toBe(updateData.description)
  })

  it('Should throw, not owner ', async () => {
    const updateData = { name: 'TokenName2', uid: token.uid, title: 'title', description: 'description' }
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), updateData)
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.you_are_not_guardian_of_space.key)
  })

})

describe("Token controller: " + WEN_FUNC.orderToken, () => {
  let memberAddress: string;
  let space: Space;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, memberAddress, {})
    await testEnv.wrap(createMember)(memberAddress);
    mockWalletReturnValue(walletSpy, memberAddress, { name: 'Space A' })
    space = await testEnv.wrap(createSpace)({});

    const tokenId = wallet.getRandomEthAddress()
    token = ({
      symbol: 'MYWO',
      totalSupply: 1000,
      pending: true,
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
      status: TokenStatus.READY,
      totalDeposit: 0
    })
    await admin.firestore().doc(`${COL.TOKENS}/${token.uid}`).set(token);

    const spaceValidation = await validateSpaceAddressFunc(walletSpy, memberAddress, space.uid);
    const nextMilestone = await submitMilestoneFunc(spaceValidation.payload.targetAddress, spaceValidation.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const memberValidation = await validateMemberAddressFunc(walletSpy, memberAddress);
    const nextMilestone2 = await submitMilestoneFunc(memberValidation.payload.targetAddress, memberValidation.payload.amount);
    await milestoneProcessed(nextMilestone2.milestone, nextMilestone2.tranId);
  });

  it('Should create token order', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const purchase = (await admin.firestore().doc(`${COL.TOKENS}/${token.uid}/${SUB_COL.PURCHASES}/${memberAddress}`).get()).data()
    expect(purchase?.totalDeposit).toBe(MIN_IOTA_AMOUNT)
  })

  it('Should order more token', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const order2 = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone2 = await submitMilestoneFunc(order2.payload.targetAddress, order2.payload.amount);
    await milestoneProcessed(nextMilestone2.milestone, nextMilestone2.tranId);

    const purchase = (await admin.firestore().doc(`${COL.TOKENS}/${token.uid}/${SUB_COL.PURCHASES}/${memberAddress}`).get()).data()
    expect(purchase?.totalDeposit).toBe(MIN_IOTA_AMOUNT * 2)
  })

  it('Should create token order and should credit some amount', async () => {
    for (const _ of [0, 1]) {
      const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
      const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
    }

    const purchase = (await admin.firestore().doc(`${COL.TOKENS}/${token.uid}/${SUB_COL.PURCHASES}/${memberAddress}`).get()).data()
    expect(purchase?.totalDeposit).toBe(MIN_IOTA_AMOUNT * 2)

    await admin.firestore().doc(`${COL.TOKENS}/${token.uid}`).update({
      saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
      coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate())
    });

    const credit = await submitCreditTokenFunc(walletSpy, memberAddress, { token: token.uid, amount: MIN_IOTA_AMOUNT });
    const nextMilestone2 = await submitMilestoneFunc(credit.payload.targetAddress, credit.payload.amount);
    await milestoneProcessed(nextMilestone2.milestone, nextMilestone2.tranId);

    const updatedPurchase = (await admin.firestore().doc(`${COL.TOKENS}/${token.uid}/${SUB_COL.PURCHASES}/${memberAddress}`).get()).data()
    expect(updatedPurchase?.totalDeposit).toBe(MIN_IOTA_AMOUNT)
  })

  it('Should create token order and should credit all amount', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const purchase = (await admin.firestore().doc(`${COL.TOKENS}/${token.uid}/${SUB_COL.PURCHASES}/${memberAddress}`).get()).data()
    expect(purchase?.totalDeposit).toBe(MIN_IOTA_AMOUNT)

    await admin.firestore().doc(`${COL.TOKENS}/${token.uid}`).update({
      saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
      coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate())
    });

    const credit = await submitCreditTokenFunc(walletSpy, memberAddress, { token: token.uid, amount: MIN_IOTA_AMOUNT });
    const nextMilestone2 = await submitMilestoneFunc(credit.payload.targetAddress, credit.payload.amount);
    await milestoneProcessed(nextMilestone2.milestone, nextMilestone2.tranId);

    const updatedPurchase = (await admin.firestore().doc(`${COL.TOKENS}/${token.uid}/${SUB_COL.PURCHASES}/${memberAddress}`).get()).data()
    expect(updatedPurchase?.totalDeposit).toBe(0)
  })

  it('Should throw, amount too much to refund', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const purchase = (await admin.firestore().doc(`${COL.TOKENS}/${token.uid}/${SUB_COL.PURCHASES}/${memberAddress}`).get()).data()
    expect(purchase?.totalDeposit).toBe(token.pricePerToken)

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, amount: MIN_IOTA_AMOUNT * 4 });
    await expectThrow(testEnv.wrap(creditToken)({}), WenError.not_enough_funds.key)
  })

  it('Should throw, amount too much to refund after second credit', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    await admin.firestore().doc(`${COL.TOKENS}/${token.uid}`).update({
      saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
      coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate())
    });

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, amount: token.pricePerToken });
    await testEnv.wrap(creditToken)({})

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, amount: token.pricePerToken });
    await expectThrow(testEnv.wrap(creditToken)({}), WenError.not_enough_funds.key)
  })

})

const tokenProcessed = async (tokenId: string, purchaseLength: number, reconciled: boolean) => {
  for (let attempt = 0; attempt < 400; ++attempt) {
    await new Promise((r) => setTimeout(r, 1000));
    const doc = await admin.firestore().doc(`${COL.TOKENS}/${tokenId}`).get();
    const purchasesSnap = await admin.firestore().collection(`${COL.TOKENS}/${tokenId}/${SUB_COL.PURCHASES}`).get()
    const purchasesOk = purchasesSnap.docs.reduce((acc, doc) => acc && ((doc.data()?.reconciled || false) === reconciled), purchaseLength === purchasesSnap.docs.length)
    if (purchasesOk && doc.data()?.status === TokenStatus.READY) {
      return
    }
  }
  throw new Error("Token not processed: " + tokenId);
}

describe('Token trigger test', () => {
  const totalTokenSupply = 10;
  const tokenPercentageForSale = 100;
  const pricePerToken = MIN_IOTA_AMOUNT
  let guardian: Member;
  let space: Space;
  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    const memberAddress = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, memberAddress, {})
    guardian = await testEnv.wrap(createMember)(memberAddress);
    mockWalletReturnValue(walletSpy, memberAddress, { name: 'Space A' })
    space = await testEnv.wrap(createSpace)({});

    const tokenId = wallet.getRandomEthAddress()
    token = ({
      symbol: 'SOON',
      totalSupply: totalTokenSupply,
      pending: false,
      icon: 'icon',
      overviewGraphics: 'overviewGraphics',
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space: space.uid,
      uid: tokenId,
      pricePerToken,
      allocations: [
        { title: 'Public sale', isPublicSale: true, percentage: tokenPercentageForSale },
      ],
      createdBy: guardian.uid,
      name: 'MyToken',
      wenUrl: 'https://wen.soonaverse.com/token/' + tokenId,
      saleLength: 86400000 * 2,
      saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
      links: [],
      status: TokenStatus.READY,
      totalDeposit: 0
    })
    await admin.firestore().doc(`${COL.TOKENS}/${token.uid}`).set(token);

    const spaceValidation = await validateSpaceAddressFunc(walletSpy, memberAddress, space.uid);
    const nextMilestone = await submitMilestoneFunc(spaceValidation.payload.targetAddress, spaceValidation.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
  });


  it('Should buy tokens', async () => {
    const totalAmounts = [4, 8, 2]
    const amounts = [3, 6, 1]
    const refunds = [1, 2, 1]

    const members = Array.from(Array(totalAmounts.length)).map((_) => wallet.getRandomEthAddress());

    for (const member of members) {
      mockWalletReturnValue(walletSpy, member, {})
      await testEnv.wrap(createMember)(member);
      const memberValidation = await validateMemberAddressFunc(walletSpy, member);
      const milestone = await submitMilestoneFunc(memberValidation.payload.targetAddress, memberValidation.payload.amount);
      await milestoneProcessed(milestone.milestone, milestone.tranId);
    }

    for (let i = 0; i < members.length; ++i) {
      for (let j = 0; j < totalAmounts[i]; ++j) {
        const order = await submitTokenOrderFunc(walletSpy, members[i], { token: token.uid });
        const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
        await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
      }
    }

    await admin.firestore().doc(`${COL.TOKENS}/${token.uid}`).update({ status: TokenStatus.PROCESSING_PAYMENTS });

    await tokenProcessed(token.uid, totalAmounts.length, true)

    const snap = await admin.firestore().collection(`${COL.TOKENS}/${token.uid}/${SUB_COL.PURCHASES}`).get()
    snap.docs.forEach(doc => {
      const memberIndex = members.indexOf(doc.data().member)
      expect(doc.data()?.amount).toBe(MIN_IOTA_AMOUNT * amounts[memberIndex])
      expect(doc.data()?.refundedAmount).toBe(MIN_IOTA_AMOUNT * refunds[memberIndex])
    })
  })
})
