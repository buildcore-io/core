import { build5Db } from '@build-5/database';
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  NetworkAddress,
  Proposal,
  ProposalMember,
  ProposalType,
  SOON_PROJECT_ID,
  Space,
  SUB_COL,
  TokenStatus,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import {
  approveProposal,
  createProposal,
  voteOnProposal,
} from '../../src/runtime/firebase/proposal';
import { joinSpace } from '../../src/runtime/firebase/space';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { getWallet, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

export class Helper {
  public walletSpy: any;
  public guardian: string = '';
  public member: string = '';
  public space: Space | undefined;
  public proposal: Proposal | undefined;
  public walletService: Wallet | undefined;
  public guardianAddress: AddressDetails | undefined;
  public network = Network.RMS;
  public tokenId = '';

  public beforeAll = async () => {
    this.walletService = await getWallet(Network.RMS);
  };

  public beforeEach = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.guardian = await createMember(this.walletSpy);
    this.member = await createMember(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian);

    mockWalletReturnValue(this.walletSpy, this.member, { uid: this.space.uid });
    await testEnv.wrap(joinSpace)({});

    this.proposal = dummyProposal(this.space.uid);

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardianData = await guardianDocRef.get<Member>();
    const guardianAddressBech = getAddress(guardianData, this.network);
    this.guardianAddress = await this.walletService!.getAddressDetails(guardianAddressBech);

    this.tokenId = wallet.getRandomEthAddress();
    await build5Db()
      .doc(`${COL.TOKEN}/${this.tokenId}`)
      .create({
        project: SOON_PROJECT_ID,
        uid: this.tokenId,
        space: this.space.uid,
        mintingData: { tokenId: MINTED_TOKEN_ID },
        status: TokenStatus.MINTED,
        approved: true,
      });

    const { uid, ...requestData } = this.proposal;
    set(requestData, 'settings.startDate', this.proposal.settings.startDate.toDate());
    set(requestData, 'settings.endDate', this.proposal.settings.endDate.toDate());
    mockWalletReturnValue(this.walletSpy, this.guardian, requestData);
    this.proposal = await testEnv.wrap(createProposal)({});
    mockWalletReturnValue(this.walletSpy, this.guardian, { uid: this.proposal?.uid });
    await testEnv.wrap(approveProposal)({});
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

  public sendTokensToVote = async (
    targetAddress: NetworkAddress,
    tokenAmount = 10,
    sourceAddress: AddressDetails = this.guardianAddress!,
    baseTokenAmount = 0,
  ) => {
    await this.walletService!.send(sourceAddress, targetAddress, baseTokenAmount, {
      nativeTokens: [{ id: MINTED_TOKEN_ID, amount: BigInt(tokenAmount) }],
    });
    await MnemonicService.store(sourceAddress.bech32, sourceAddress.mnemonic, Network.RMS);
  };

  public awaitVoteTransactionCreditIsConfirmed = async (
    voteTransactionOrderTargetAddress: NetworkAddress,
  ) => {
    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('payload.sourceAddress', '==', voteTransactionOrderTargetAddress)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const creditSnap = await query.get<Transaction>();
      return creditSnap.length === 1 && creditSnap[0]?.payload?.walletReference?.confirmed;
    });
    const creditSnap = await query.get();
    return creditSnap[0] as Transaction;
  };

  public getVoteTransactionForCredit = async (creditId: string) => {
    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('payload.creditId', '==', creditId)
      .where('type', '==', TransactionType.VOTE);
    const voteTranSnap = await query.get();
    return voteTranSnap[0] as Transaction;
  };

  public updatePropoasalDates = (startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) =>
    build5Db()
      .doc(`${COL.PROPOSAL}/${this.proposal!.uid}`)
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

  public assertProposalWeights = async (
    total: number,
    voted: number,
    proposalId = this.proposal!.uid,
  ) => {
    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposalId}`);
    const proposal = <Proposal>await proposalDocRef.get();
    expect(+proposal.results?.total.toFixed(0)).toBe(total);
    expect(+proposal.results?.voted.toFixed(0)).toBe(voted);
  };

  public assertProposalMemberWeightsPerAnser = async (
    member: string,
    weight: number,
    answer: number,
    proposalId = this.proposal!.uid,
  ) => {
    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposalId}`);
    const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(member);
    const proposalMember = <ProposalMember>await proposalMemberDocRef.get();
    expect(+proposalMember.weightPerAnswer![answer].toFixed(0)).toBe(weight);
  };

  public voteOnProposal = async (
    value: number,
    voteWithStakedTokes = false,
    member = this.guardian,
    proposalId = this.proposal!.uid,
  ) => {
    mockWalletReturnValue(this.walletSpy, member, {
      uid: proposalId,
      value,
      voteWithStakedTokes,
    });
    return await testEnv.wrap(voteOnProposal)({});
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

  public getTransaction = async (uid: string) => {
    const docRef = build5Db().doc(`${COL.TRANSACTION}/${uid}`);
    return <Transaction>await docRef.get();
  };
}

export const dummyProposal = (space: string): Proposal => ({
  uid: '',
  description: '',
  name: 'All 4 HORNET',
  space,
  additionalInfo: 'The biggest governance decision in the history of IOTA',
  settings: {
    startDate: dateToTimestamp(dayjs().add(1, 'd')),
    endDate: dateToTimestamp(dayjs().add(5, 'd')),
    onlyGuardians: false,
  },
  type: ProposalType.NATIVE,
  questions: [
    {
      text: 'Give all the funds to the HORNET developers?',
      answers: [
        { value: 1, text: 'YES', additionalInfo: 'Go team!' },
        {
          value: 2,
          text: 'Doh! Of course!',
          additionalInfo: 'There is no other option',
        },
      ],
      additionalInfo: 'This would fund the development of HORNET indefinitely',
    },
  ],
});

export const VAULT_MNEMONIC =
  'spoil combine iron zero junk confirm present erase miracle lazy town rough chapter broken atom scare that mutual step parade always face loan guide';
export const MINTED_TOKEN_ID =
  '0x087c042b2aea020609809189e329fed4a0bbf549a4156bae3c52e07c9b4466975c0100000000';
