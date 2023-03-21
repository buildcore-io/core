import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Proposal,
  ProposalMember,
  ProposalSubType,
  ProposalType,
  Space,
  SUB_COL,
  TangleRequestType,
  TokenStatus,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

export class Helper {
  constructor(public readonly type = ProposalType.NATIVE) {}

  public walletSpy: any = {} as any;
  public guardian: string = '';
  public space: Space = {} as any;
  public guardianAddress: AddressDetails = {} as any;
  public walletService: SmrWallet = {} as any;
  public tangleOrder: Transaction = {} as any;
  public network = Network.RMS;
  public guardianCreditQuery: admin.firestore.Query<admin.firestore.DocumentData> = {} as any;
  public tokenId = '';
  public proposalUid = '';

  public beforeAll = async () => {
    this.walletService = (await WalletService.newWallet(this.network)) as SmrWallet;
    this.tangleOrder = await getTangleOrder();
  };

  public beforeEach = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.guardian = await createMember(this.walletSpy);
    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardianData = <Member>(await guardianDocRef.get()).data();
    const guardianBech32 = getAddress(guardianData, this.network);
    this.guardianAddress = await this.walletService.getAddressDetails(guardianBech32);

    this.space = await createSpace(this.walletSpy, this.guardian);

    this.tokenId = wallet.getRandomEthAddress();
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${this.tokenId}`)
      .create({
        uid: this.tokenId,
        space: this.space.uid,
        status: TokenStatus.MINTED,
        mintingData: { tokenId: MINTED_TOKEN_ID },
        approved: true,
      });

    const distributionDocRef = admin
      .firestore()
      .collection(COL.TOKEN)
      .doc(this.tokenId)
      .collection(SUB_COL.DISTRIBUTION)
      .doc(this.guardian);
    await distributionDocRef.create({});

    this.guardianCreditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', this.guardian);

    await requestFundsFromFaucet(Network.RMS, this.guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
  };

  public sendCreateProposalRequest = async () => {
    await this.walletService.send(
      this.guardianAddress,
      this.tangleOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.PROPOSAL_CREATE,
            ...proposalRequest(this.space.uid, this.type),
          },
        },
      },
    );
    await MnemonicService.store(this.guardianAddress.bech32, this.guardianAddress.mnemonic);

    await wait(async () => {
      const snap = await this.guardianCreditQuery.get();
      return snap.size === 1;
    });

    const snap = await this.guardianCreditQuery.get();
    const credit = snap.docs[0].data() as Transaction;
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT);

    expect(credit.payload.response.proposal).toBeDefined();

    this.proposalUid = credit.payload.response.proposal;
    return credit.payload.response.proposal;
  };

  public requestFunds = async () => {
    await requestFundsFromFaucet(Network.RMS, this.guardianAddress!.bech32, MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      this.walletService!,
      this.guardianAddress!,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      10,
    );
  };

  public createStake = async (createdOn: dayjs.Dayjs, expiresAt: dayjs.Dayjs, amount = 100) => {
    const stake = {
      createdOn: dateToTimestamp(createdOn),
      expiresAt: dateToTimestamp(expiresAt),
      amount,
      member: this.guardian,
      uid: wallet.getRandomEthAddress(),
      token: this.tokenId,
    };
    const docRef = admin.firestore().doc(`${COL.STAKE}/${stake.uid}`);
    await docRef.create(stake);
  };

  public assertProposalWeights = async (total: number, voted: number) => {
    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${this.proposalUid}`);
    const proposal = <Proposal>(await proposalDocRef.get()).data();
    expect(+proposal.results?.total.toFixed(0)).toBe(total);
    expect(+proposal.results?.voted.toFixed(0)).toBe(voted);
  };

  public assertProposalMemberWeightsPerAnser = async (
    member: string,
    weight: number,
    answer: number,
  ) => {
    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${this.proposalUid}`);
    const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(member);
    const proposalMember = <ProposalMember>(await proposalMemberDocRef.get()).data();
    expect(+proposalMember.weightPerAnswer![answer].toFixed(0)).toBe(weight);
  };

  public updatePropoasalDates = (startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) =>
    admin
      .firestore()
      .doc(`${COL.PROPOSAL}/${this.proposalUid}`)
      .set(
        {
          settings: {
            startDate: dateToTimestamp(startDate),
            endDate: dateToTimestamp(endDate),
          },
        },
        { merge: true },
      );

  public updateVoteTranCreatedOn = (voteTransactionId: string, createdOn: dayjs.Dayjs) =>
    admin
      .firestore()
      .doc(`${COL.TRANSACTION}/${voteTransactionId}`)
      .update({ createdOn: dateToTimestamp(createdOn) });

  public getVoteTransactionForCredit = async (creditId: string) => {
    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.creditId', '==', creditId)
      .where('type', '==', TransactionType.VOTE);
    const voteTranSnap = await query.get();
    return voteTranSnap.docs[0].data() as Transaction;
  };
}

const proposalRequest = (space: string, type: ProposalType) => ({
  name: 'All 4 HORNET',
  space,
  additionalInfo: 'The biggest governance decision in the history of IOTA',
  settings: {
    startDate:
      type === ProposalType.MEMBERS
        ? dayjs().subtract(1, 'd').toDate()
        : dayjs().add(1, 'd').toDate(),
    endDate: dayjs().add(5, 'd').toDate(),
    onlyGuardians: false,
  },
  type,
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

export const VAULT_MNEMONIC =
  'offer kingdom rate never hurt follow wrestle cloud alien admit bird usage avoid cloth soldier evidence crawl harsh electric wheat ten mushroom glare reject';

export const MINTED_TOKEN_ID =
  '0x085f6308dd034c70ea90b4e2600c4f8fb65d0b53504a0d96e37ce8641a8835d2110100000000';