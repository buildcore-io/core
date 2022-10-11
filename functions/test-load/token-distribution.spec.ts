import dayjs from 'dayjs';
import { MIN_IOTA_AMOUNT } from '../interfaces/config';
import { Member, Space } from '../interfaces/models';
import { COL, SUB_COL } from '../interfaces/models/base';
import { TokenStatus } from '../interfaces/models/token';
import admin from '../src/admin.config';
import { dateToTimestamp, serverTime } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import { createMember, createSpace, getRandomSymbol, wait } from '../test/controls/common';
import { createMemberCopies } from './common';

let walletSpy: any;

const dummyToken = (
  totalSupply: number,
  space: Space,
  pricePerToken: number,
  publicPercentageSale: number,
  guardian: string,
) => ({
  symbol: getRandomSymbol(),
  totalSupply,
  updatedOn: serverTime(),
  createdOn: serverTime(),
  space: space.uid,
  uid: wallet.getRandomEthAddress(),
  pricePerToken,
  allocations: [{ title: 'Public sale', isPublicSale: true, percentage: publicPercentageSale }],
  createdBy: guardian,
  name: 'MyToken',
  saleLength: 86400000 * 2,
  saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
  links: [],
  status: TokenStatus.AVAILABLE,
  totalDeposit: 0,
  totalAirdropped: 0,
});

describe('Token trigger stress test', () => {
  let guardian: string;
  let space: Space;
  let token: any;
  const membersCount = 6000;
  let members: string[];

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);
    const guardianDoc = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${guardian}`).get()).data()
    );
    members = await createMemberCopies(guardianDoc, membersCount);
  });

  it('Should buy a lot of tokens', async () => {
    token = dummyToken(membersCount, space, MIN_IOTA_AMOUNT, 100, guardian);
    console.log('TOKENID', token.uid);
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).create(token);

    const orderPromises = members.map(async (member) => {
      const order = {
        uid: member,
        totalDeposit: admin.firestore.FieldValue.increment(MIN_IOTA_AMOUNT),
        parentId: token.uid,
        parentCol: COL.TOKEN,
        createdOn: serverTime(),
      };
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`)
        .create(order);
    });
    await Promise.all(orderPromises);
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ status: TokenStatus.PROCESSING });

    await wait(async () => {
      const tokenData = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data();
      return tokenData?.status === TokenStatus.PRE_MINTED;
    }, 6000);
  });
});
