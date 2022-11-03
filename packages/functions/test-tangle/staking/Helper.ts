/* eslint-disable @typescript-eslint/no-explicit-any */
import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  MAX_WEEKS_TO_STAKE,
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
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import admin from '../../src/admin.config';
import { depositStake } from '../../src/controls/stake.control';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { MilestoneListener } from '../db-sync.utils';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

export class Helper {
  public TOKEN_ID =
    '0x08319d70d87e0296576769a768a0dd16953676d01046cea911c3dde62fb00f0eb40100000000';
  public VAULT_MNEMONIC =
    'multiply sound whale way attract dentist identify wear much oxygen matter movie harsh oil vintage real island history era galaxy image wonder usage giraffe';

  public listenerRMS: MilestoneListener | undefined;
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
    this.listenerRMS = new MilestoneListener(this.network);
    this.walletService = (await WalletService.newWallet(this.network)) as SmrWallet;
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
  ) => {
    mockWalletReturnValue(this.walletSpy, this.member!.uid, {
      token: this.token?.uid,
      weeks,
      type: type || StakeType.DYNAMIC,
      customMetadata,
    });
    const order = await testEnv.wrap(depositStake)({});
    await this.walletService!.send(
      this.memberAddress!,
      order.payload.targetAddress,
      order.payload.amount,
      {
        expiration: expiresAt
          ? { expiresAt, returnAddressBech32: this.memberAddress!.bech32 }
          : undefined,
        nativeTokens: [{ id: this.TOKEN_ID, amount: HexHelper.fromBigInt256(bigInt(amount)) }],
      },
    );
    await MnemonicService.store(
      this.memberAddress!.bech32,
      this.memberAddress!.mnemonic,
      Network.RMS,
    );
    const query = admin.firestore().collection(COL.STAKE).where('orderId', '==', order.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size == 1;
    });
    const stake = <Stake>(await query.get()).docs[0].data();
    expect(stake.amount).toBe(amount);
    expect(stake.member).toBe(this.member!.uid);
    expect(stake.value).toBe(Math.floor(amount * (1 + weeks / MAX_WEEKS_TO_STAKE)));
    expect(stake.weeks).toBe(weeks);
    expect(stake.orderId).toBe(order.uid);
    expect(stake.billPaymentId).toBeDefined();
    expect(stake.token).toBe(this.token?.uid);

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
    return stake;
  };

  public validateStatsStakeAmount = async (
    stakeAmount: number,
    stakeTotalAmount: number,
    stakeValue: number,
    stakeTotalValue: number,
    type: StakeType,
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
  };

  public validateMemberStakeAmount = async (
    stakeAmount: number,
    stakeTotalAmount: number,
    stakeValue: number,
    stakeTotalValue: number,
    type: StakeType,
  ) => {
    const distribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${this.token!.uid}/${SUB_COL.DISTRIBUTION}/${this.member!.uid}`)
          .get()
      ).data()
    );
    expect(distribution.stakes![type].amount).toBe(stakeAmount);
    expect(distribution.stakes![type].totalAmount).toBe(stakeTotalAmount);
    expect(distribution.stakes![type].value).toBe(stakeValue);
    expect(distribution.stakes![type].totalValue).toBe(stakeTotalValue);
  };
}
