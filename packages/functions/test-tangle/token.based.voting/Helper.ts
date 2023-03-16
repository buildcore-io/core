import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Proposal,
  ProposalMember,
  ProposalSubType,
  ProposalType,
  Space,
  SUB_COL,
  TokenStatus,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import {
  approveProposal,
  createProposal,
  voteOnProposal,
} from '../../src/runtime/firebase/proposal';
import { joinSpace } from '../../src/runtime/firebase/space';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

export class Helper {
  public walletSpy: any;
  public guardian: string = '';
  public member: string = '';
  public space: Space | undefined;
  public proposal: Proposal | undefined;
  public walletService: SmrWallet | undefined;
  public guardianAddress: AddressDetails | undefined;
  public network = Network.RMS;
  public tokenId = '';

  public beforeAll = async () => {
    this.walletService = (await WalletService.newWallet(Network.RMS)) as SmrWallet;
  };

  public beforeEach = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.guardian = await createMember(this.walletSpy);
    this.member = await createMember(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian);

    mockWalletReturnValue(this.walletSpy, this.member, { uid: this.space.uid });
    await testEnv.wrap(joinSpace)({});

    this.proposal = dummyProposal(this.space.uid);

    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardianData = (await guardianDocRef.get()).data();
    const guardianAddressBech = getAddress(guardianData, this.network);
    this.guardianAddress = await this.walletService!.getAddressDetails(guardianAddressBech);

    this.tokenId = wallet.getRandomEthAddress();
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${this.tokenId}`)
      .create({
        uid: this.tokenId,
        space: this.space.uid,
        mintingData: { tokenId: MINTED_TOKEN_ID },
        status: TokenStatus.MINTED,
      });

    mockWalletReturnValue(this.walletSpy, this.guardian, this.proposal);
    this.proposal = await testEnv.wrap(createProposal)({});
    mockWalletReturnValue(this.walletSpy, this.guardian, { uid: this.proposal!.uid });
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
    targetAddress: string,
    tokenAmount = 10,
    sourceAddress: AddressDetails = this.guardianAddress!,
    baseTokenAmount = 0,
  ) => {
    await this.walletService!.send(sourceAddress, targetAddress, baseTokenAmount, {
      nativeTokens: [{ id: MINTED_TOKEN_ID, amount: HexHelper.fromBigInt256(bigInt(tokenAmount)) }],
    });
    await MnemonicService.store(sourceAddress.bech32, sourceAddress.mnemonic, Network.RMS);
  };

  public awaitVoteTransactionCreditIsConfirmed = async (
    voteTransactionOrderTargetAddress: string,
  ) => {
    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.sourceAddress', '==', voteTransactionOrderTargetAddress)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const creditSnap = await query.get();
      return (
        creditSnap.size === 1 && creditSnap.docs[0].data()?.payload?.walletReference?.confirmed
      );
    });
    const creditSnap = await query.get();
    return creditSnap.docs[0].data() as Transaction;
  };

  public getVoteTransactionForCredit = async (creditId: string) => {
    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.creditId', '==', creditId)
      .where('type', '==', TransactionType.VOTE);
    const voteTranSnap = await query.get();
    return voteTranSnap.docs[0].data() as Transaction;
  };

  public updatePropoasalDates = (startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) =>
    admin
      .firestore()
      .doc(`${COL.PROPOSAL}/${this.proposal!.uid}`)
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

  public assertProposalWeights = async (
    total: number,
    voted: number,
    proposalId = this.proposal!.uid,
  ) => {
    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposalId}`);
    const proposal = <Proposal>(await proposalDocRef.get()).data();
    expect(+proposal.results?.total.toFixed(0)).toBe(total);
    expect(+proposal.results?.voted.toFixed(0)).toBe(voted);
  };

  public assertProposalMemberWeightsPerAnser = async (
    member: string,
    weight: number,
    answer: number,
    proposalId = this.proposal!.uid,
  ) => {
    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposalId}`);
    const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(member);
    const proposalMember = <ProposalMember>(await proposalMemberDocRef.get()).data();
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
      values: [value],
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
    const docRef = admin.firestore().doc(`${COL.STAKE}/${stake.uid}`);
    await docRef.create(stake);
  };

  public getTransaction = async (uid: string) => {
    const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${uid}`);
    return <Transaction>(await docRef.get()).data();
  };
}

export const dummyProposal = (space: string) =>
  <Proposal>{
    name: 'All 4 HORNET',
    space,
    additionalInfo: 'The biggest governance decision in the history of IOTA',
    settings: {
      startDate: dayjs().add(1, 'd').toDate(),
      endDate: dayjs().add(5, 'd').toDate(),
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
  };

export const VAULT_MNEMONIC =
  'offer kingdom rate never hurt follow wrestle cloud alien admit bird usage avoid cloth soldier evidence crawl harsh electric wheat ten mushroom glare reject';

export const MINTED_TOKEN_ID =
  '0x085f6308dd034c70ea90b4e2600c4f8fb65d0b53504a0d96e37ce8641a8835d2110100000000';
