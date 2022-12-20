/* eslint-disable @typescript-eslint/no-explicit-any */
import { HexHelper } from '@iota/util.js-next';
import {
  calcStakedMultiplier,
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  Stake,
  StakeType,
  SUB_COL,
  Timestamp,
  Token,
  TokenDistribution,
  TokenStats,
  TokenStatus,
  Transaction,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { depositStake } from '../../src/controls/stake.control';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../../test/controls/common';
import { getWallet, MEDIA, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

export class Helper {
  public TOKEN_ID =
    '0x087dbad2655a6b8846f51a91973745e583657614c5160e0ab969309c0322132f8b0100000000';
  public VAULT_MNEMONIC =
    'woman bulk engine voice travel tobacco other fiscal dress life text gossip tag situate skill social item dance friend scissors small setup lava key';

  public member: Member | undefined;
  public memberAddress: AddressDetails | undefined;
  public space: Space | undefined;
  public walletService: SmrWallet | undefined;
  public walletSpy: any;
  public network = Network.RMS;
  public token: Token | undefined;
  public tokenStats: TokenStats | undefined;

  public beforeAll = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.walletService = (await getWallet(this.network)) as SmrWallet;
  };

  public beforeEach = async () => {
    const memberId = await createMember(this.walletSpy);
    this.member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${memberId}`).get()).data();
    this.memberAddress = await this.walletService!.getAddressDetails(
      getAddress(this.member, this.network),
    );
    this.space = await createSpace(this.walletSpy, memberId);
    this.token = await this.saveToken(this.space!.uid, this.member.uid);
    this.tokenStats = <TokenStats>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${this.token.uid}/${SUB_COL.STATS}/${this.token.uid}`)
          .get()
      ).data()
    );
    await requestFundsFromFaucet(this.network, this.memberAddress.bech32, 10 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      this.walletService!,
      this.memberAddress,
      this.TOKEN_ID,
      this.VAULT_MNEMONIC,
      100,
    );
  };

  public saveToken = async (space: string, guardian: string) => {
    const vaultAddress = await this.walletService!.getIotaAddressDetails(this.VAULT_MNEMONIC);
    const token = {
      symbol: getRandomSymbol(),
      approved: true,
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space,
      uid: wallet.getRandomEthAddress(),
      createdBy: guardian,
      name: 'MyToken',
      status: TokenStatus.MINTED,
      mintingData: {
        tokenId: this.TOKEN_ID,
        network: Network.RMS,
        vaultAddress: vaultAddress.bech32,
      },
      access: 0,
      icon: MEDIA,
    };
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
    return <Token>token;
  };

  public stakeAmount = async (
    amount: number,
    weeks = 26,
    expiresAt?: Timestamp,
    type?: StakeType,
    customMetadata?: { [key: string]: string },
    memberUid?: string,
  ) => {
    const member = <Member>(
      await admin
        .firestore()
        .doc(`${COL.MEMBER}/${memberUid || this.member?.uid}`)
        .get()
    ).data();
    const memberAddress = await this.walletService?.getAddressDetails(
      getAddress(member, this.network),
    )!;
    mockWalletReturnValue(this.walletSpy, member.uid, {
      symbol: this.token?.symbol,
      weeks,
      type: type || StakeType.DYNAMIC,
      customMetadata,
    });
    const order = await testEnv.wrap(depositStake)({});
    await this.walletService!.send(
      memberAddress,
      order.payload.targetAddress,
      order.payload.amount,
      {
        expiration: expiresAt
          ? { expiresAt, returnAddressBech32: memberAddress!.bech32 }
          : undefined,
        nativeTokens: [{ id: this.TOKEN_ID, amount: HexHelper.fromBigInt256(bigInt(amount)) }],
      },
    );
    await MnemonicService.store(memberAddress!.bech32, memberAddress!.mnemonic, Network.RMS);
    const query = admin.firestore().collection(COL.STAKE).where('orderId', '==', order.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size == 1;
    });
    const stake = (await query.get()).docs[0].data() as Stake;
    expect(stake.amount).toBe(amount);
    expect(stake.member).toBe(member!.uid);
    expect(stake.value).toBe(Math.floor(amount * calcStakedMultiplier(weeks)));
    expect(stake.weeks).toBe(weeks);
    expect(stake.orderId).toBe(order.uid);
    expect(stake.billPaymentId).toBeDefined();
    expect(stake.token).toBe(this.token?.uid!);

    await wait(async () => {
      const currTokenStats = <TokenStats | undefined>(
        (
          await admin
            .firestore()
            .doc(`${COL.TOKEN}/${this.token?.uid}/${SUB_COL.STATS}/${this.token?.uid}`)
            .get()
        ).data()
      );
      return (
        (currTokenStats?.stakes || {})[type || StakeType.DYNAMIC]?.totalAmount !==
        (this.tokenStats?.stakes || {})[type || StakeType.DYNAMIC]?.totalAmount
      );
    });

    const billPaymentDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${stake.billPaymentId}`);
    await wait(async () => {
      const billPayment = <Transaction>(await billPaymentDocRef.get()).data();
      return billPayment.payload.walletReference?.confirmed;
    });
    const billPayment = <Transaction>(await billPaymentDocRef.get()).data();
    expect(billPayment.payload.nativeTokens[0].amount).toBe(stake.amount);

    return stake;
  };

  public validateStatsStakeAmount = async (
    stakeAmount: number,
    stakeTotalAmount: number,
    stakeValue: number,
    stakeTotalValue: number,
    type: StakeType,
    membersCount: number,
  ) => {
    this.tokenStats = <TokenStats>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${this.token!.uid}/${SUB_COL.STATS}/${this.token?.uid}`)
          .get()
      ).data()
    );
    expect(this.tokenStats.stakes![type].amount).toBe(stakeAmount);
    expect(this.tokenStats.stakes![type].totalAmount).toBe(stakeTotalAmount);
    expect(this.tokenStats.stakes![type].value).toBe(stakeValue);
    expect(this.tokenStats.stakes![type].totalValue).toBe(stakeTotalValue);
    expect(this.tokenStats.stakes![type].stakingMembersCount).toBe(membersCount);
  };

  public validateMemberStakeAmount = async (
    stakeAmount: number,
    stakeTotalAmount: number,
    stakeValue: number,
    stakeTotalValue: number,
    type: StakeType,
    member?: string,
  ) => {
    const distribution = <TokenDistribution>(
      await admin
        .firestore()
        .doc(
          `${COL.TOKEN}/${this.token!.uid}/${SUB_COL.DISTRIBUTION}/${member || this.member!.uid}`,
        )
        .get()
    ).data();
    expect(distribution.stakes![type].amount).toBe(stakeAmount);
    expect(distribution.stakes![type].totalAmount).toBe(stakeTotalAmount);
    expect(distribution.stakes![type].value).toBe(stakeValue);
    expect(distribution.stakes![type].totalValue).toBe(stakeTotalValue);
  };

  public assertDistributionStakeExpiry = async (stake: Stake) => {
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${this.token?.uid}/${SUB_COL.DISTRIBUTION}/${this.member!.uid}`);
    const distirbution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distirbution.stakeExpiry![stake.type][stake.expiresAt.toMillis()]).toBe(stake.value);
  };

  public updateStakeExpiresAt = async (stake: Stake, expiresAt: dayjs.Dayjs) => {
    await admin
      .firestore()
      .doc(`${COL.STAKE}/${stake.uid}`)
      .update({ expiresAt: dateToTimestamp(expiresAt.toDate()) });
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${this.token?.uid}/${SUB_COL.DISTRIBUTION}/${this.member!.uid}`);
    await distributionDocRef.set(
      {
        stakeExpiry: {
          [stake.type]: {
            [stake.expiresAt.toMillis()]: admin.firestore.FieldValue.delete(),
            [dateToTimestamp(expiresAt.toDate()).toMillis()]: stake.value,
          },
        },
      },
      { merge: true },
    );
  };

  public assertStakeExpiryCleared = async (type: StakeType) => {
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${this.token?.uid}/${SUB_COL.DISTRIBUTION}/${this.member!.uid}`);
    const distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(isEmpty(distribution.stakeExpiry![type])).toBe(true);
  };
}
