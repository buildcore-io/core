import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  ProposalSubType,
  ProposalType,
  Space,
  TangleRequestType,
  TokenStatus,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

let walletSpy: any;

const proposalRequest = (space: string) => ({
  name: 'All 4 HORNET',
  space,
  additionalInfo: 'The biggest governance decision in the history of IOTA',
  settings: {
    startDate: new Date(),
    endDate: dayjs().add(5, 'day').toDate(),
    onlyGuardians: false,
  },
  type: ProposalType.NATIVE,
  subType: ProposalSubType.ONE_MEMBER_ONE_VOTE,
  questions: [
    {
      text: 'Give all the funds to the HORNET developers?',
      answers: [
        { value: 1, text: 'YES', additionalInfo: 'Go team!' },
        { value: 2, text: 'Doh! Of course!', additionalInfo: 'There is no other option' },
      ],
      additionalInfo: 'This would fund the development of HORNET indefinitely',
    },
  ],
});

describe('Create proposal via tangle request', () => {
  let guardian: string;
  let space: Space;
  let guardianAddress: AddressDetails;
  let walletService: SmrWallet;
  let tangleOrder: Transaction;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletService = (await WalletService.newWallet(Network.RMS)) as SmrWallet;
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>(await guardianDocRef.get()).data();
    const guardianBech32 = getAddress(guardianData, Network.RMS);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);

    space = await createSpace(walletSpy, guardian);

    const tokenId = wallet.getRandomEthAddress();
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).create({
      uid: tokenId,
      space: space.uid,
      status: TokenStatus.MINTED,
    });
  });

  it('Should create proposal with tangle request', async () => {
    await requestFundsFromFaucet(Network.RMS, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await walletService.send(
      guardianAddress,
      tangleOrder.payload.targetAddress,
      5 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.PROPOSAL_CREATE,
            ...proposalRequest(space.uid),
          },
        },
      },
    );

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.size === 1;
    });
    const snap = await creditQuery.get();
    const credit = snap.docs[0].data() as Transaction;
    expect(credit.payload.amount).toBe(5 * MIN_IOTA_AMOUNT);

    expect(credit.payload.response.proposal).toBeDefined();
  });
});
