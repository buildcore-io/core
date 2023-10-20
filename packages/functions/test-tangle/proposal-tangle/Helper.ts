import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Proposal,
  ProposalMember,
  ProposalType,
  Space,
  SUB_COL,
  TangleRequestType,
  TokenStatus,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { IQuery } from '../../src/firebase/firestore/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, wait } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

export class Helper {
  constructor(public readonly type = ProposalType.NATIVE) {}

  public walletSpy: any = {} as any;
  public guardian: string = '';
  public space: Space = {} as any;
  public guardianAddress: AddressDetails = {} as any;
  public walletService: Wallet = {} as any;
  public tangleOrder: Transaction = {} as any;
  public network = Network.RMS;
  public guardianCreditQuery: IQuery = {} as any;
  public tokenId = '';
  public proposalUid = '';

  public beforeAll = async () => {
    this.walletService = await getWallet(this.network);
    this.tangleOrder = await getTangleOrder(Network.RMS);
  };

  public beforeEach = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.guardian = await createMember(this.walletSpy);
    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, this.network);
    this.guardianAddress = await this.walletService.getAddressDetails(guardianBech32);

    this.space = await createSpace(this.walletSpy, this.guardian);

    this.tokenId = wallet.getRandomEthAddress();
    await build5Db()
      .doc(`${COL.TOKEN}/${this.tokenId}`)
      .create({
        uid: this.tokenId,
        space: this.space.uid,
        status: TokenStatus.MINTED,
        mintingData: { tokenId: MINTED_TOKEN_ID },
        approved: true,
      });

    const distributionDocRef = build5Db()
      .collection(COL.TOKEN)
      .doc(this.tokenId)
      .collection(SUB_COL.DISTRIBUTION)
      .doc(this.guardian);
    await distributionDocRef.create({});

    this.guardianCreditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .where('member', '==', this.guardian);

    await requestFundsFromFaucet(Network.RMS, this.guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
  };

  public sendCreateProposalRequest = async () => {
    await this.walletService.send(
      this.guardianAddress,
      this.tangleOrder.payload.targetAddress!,
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
      return snap.length === 1;
    });

    const snap = await this.guardianCreditQuery.get();
    const credit = snap[0] as Transaction;
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT);

    expect(credit.payload.response!.proposal).toBeDefined();

    this.proposalUid = credit.payload.response!.proposal as string;
    return credit.payload.response!.proposal as string;
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
    const docRef = build5Db().doc(`${COL.STAKE}/${stake.uid}`);
    await docRef.create(stake);
  };

  public assertProposalWeights = async (total: number, voted: number) => {
    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${this.proposalUid}`);
    const proposal = <Proposal>await proposalDocRef.get();
    expect(+proposal.results?.total.toFixed(0)).toBe(total);
    expect(+proposal.results?.voted.toFixed(0)).toBe(voted);
  };

  public assertProposalMemberWeightsPerAnser = async (
    member: string,
    weight: number,
    answer: number,
  ) => {
    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${this.proposalUid}`);
    const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(member);
    const proposalMember = <ProposalMember>await proposalMemberDocRef.get();
    expect(+proposalMember.weightPerAnswer![answer].toFixed(0)).toBe(weight);
  };

  public updatePropoasalDates = (startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) =>
    build5Db()
      .doc(`${COL.PROPOSAL}/${this.proposalUid}`)
      .set(
        {
          settings: {
            startDate: dateToTimestamp(startDate),
            endDate: dateToTimestamp(endDate),
          },
        },
        true,
      );

  public updateVoteTranCreatedOn = (voteTransactionId: string, createdOn: dayjs.Dayjs) =>
    build5Db()
      .doc(`${COL.TRANSACTION}/${voteTransactionId}`)
      .update({ createdOn: dateToTimestamp(createdOn) });

  public getVoteTransactionForCredit = async (creditId: string) => {
    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('payload.creditId', '==', creditId)
      .where('type', '==', TransactionType.VOTE);
    const voteTranSnap = await query.get();
    return voteTranSnap[0] as Transaction;
  };
}

const proposalRequest = (space: string, type: ProposalType) => ({
  name: 'All 4 HORNET',
  space,
  additionalInfo: 'The biggest governance decision in the history of IOTA',
  settings: {
    startDate: type === ProposalType.MEMBERS ? dayjs().toDate() : dayjs().add(1, 'd').toDate(),
    endDate: dayjs().add(5, 'd').toDate(),
    onlyGuardians: false,
  },
  type,
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
  'word promote enrich any planet square hurt conduct tongue across trumpet flavor settle bacon hole axis asset blast tennis lift monkey organ evolve mention';
export const MINTED_TOKEN_ID =
  '0x08db01317129a23b7ff618a9f73d4263c8c4c062ea5d987e8b1154b5059a3e5c960100000000';
