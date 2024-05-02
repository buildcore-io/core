/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  SOON_PROJECT_ID,
  SUB_COL,
  Space,
  Stake,
  StakeType,
  Timestamp,
  Token,
  TokenDistribution,
  TokenStats,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  WEN_FUNC,
  calcStakedMultiplier,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

export class Helper {
  public MINTED_TOKEN_ID =
    '0x08b97105c2c2a57205798940be8d955a2e5491a99229540bbcd9c98530660952bc0100000000';
  public VAULT_MNEMONIC =
    'ask vintage language rescue slab gas soda rebel delay crew vault bunker march palm supply novel whisper saddle enhance size embark minute penalty buyer';

  public member: Member | undefined;
  public memberAddress: AddressDetails | undefined;
  public space: Space | undefined;
  public walletService: Wallet | undefined;
  public network = Network.RMS;
  public token: Token | undefined;
  public tokenStats: TokenStats | undefined;

  public beforeAll = async () => {
    this.walletService = await getWallet(this.network);
  };

  public beforeEach = async () => {
    const memberId = await testEnv.createMember();
    this.member = <Member>await build5Db().doc(COL.MEMBER, memberId).get();
    this.memberAddress = await this.walletService?.getNewIotaAddressDetails();

    this.space = await testEnv.createSpace(memberId);
    this.token = await this.saveToken(this.space!.uid, this.member!.uid);
    this.tokenStats = <TokenStats>(
      await build5Db().doc(COL.TOKEN, this.token.uid, SUB_COL.STATS, this.token.uid).get()
    );
    await requestFundsFromFaucet(this.network, this.memberAddress!.bech32, 10 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      this.walletService!,
      this.memberAddress!,
      this.MINTED_TOKEN_ID,
      this.VAULT_MNEMONIC,
      100,
    );
  };

  public saveToken = async (space: string, guardian: string) => {
    const vaultAddress = await this.walletService!.getIotaAddressDetails(this.VAULT_MNEMONIC);
    const token = {
      project: SOON_PROJECT_ID,
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
        tokenId: this.MINTED_TOKEN_ID,
        network: Network.RMS,
        vaultAddress: vaultAddress.bech32,
      },
      access: 0,
      icon: MEDIA,
    } as Token;
    await build5Db().doc(COL.TOKEN, token.uid).create(token);
    return token;
  };

  public stakeAmount = async (
    amount: number,
    weeks = 26,
    expiresAt?: Timestamp,
    type?: StakeType,
    customMetadata?: { [key: string]: string },
    memberUid?: string,
  ) => {
    const member = <Member>await build5Db()
      .doc(COL.MEMBER, memberUid || this.member?.uid!)
      .get();

    const body = {
      symbol: this.token?.symbol,
      weeks,
      type: type || StakeType.DYNAMIC,
    };
    if (!isEmpty(customMetadata)) {
      set(body, 'customMetadata', customMetadata);
    }
    mockWalletReturnValue(member.uid, body);
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.depositStake);
    const address = memberUid
      ? await this.walletService!.getAddressDetails(getAddress(member, Network.RMS))
      : this.memberAddress!;
    await this.walletService!.send(address, order.payload.targetAddress!, order.payload.amount!, {
      expiration: expiresAt
        ? { expiresAt, returnAddressBech32: this.memberAddress!.bech32 }
        : undefined,
      nativeTokens: [{ id: this.MINTED_TOKEN_ID, amount: BigInt(amount) }],
    });
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);
    const query = build5Db().collection(COL.STAKE).where('orderId', '==', order.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length == 1;
    });
    const stake = (await query.get())[0] as Stake;
    expect(stake.amount).toBe(amount);
    expect(stake.member).toBe(member!.uid);
    expect(stake.value).toBe(Math.floor(amount * calcStakedMultiplier(weeks)));
    expect(stake.weeks).toBe(weeks);
    expect(stake.orderId).toBe(order.uid);
    expect(stake.billPaymentId).toBeDefined();
    expect(stake.token).toBe(this.token?.uid!);

    await wait(async () => {
      const currTokenStats = <TokenStats | undefined>(
        await build5Db().doc(COL.TOKEN, this.token?.uid!, SUB_COL.STATS, this.token?.uid).get()
      );
      return (
        (currTokenStats?.stakes || {})[type || StakeType.DYNAMIC]?.totalAmount !==
        (this.tokenStats?.stakes || {})[type || StakeType.DYNAMIC]?.totalAmount
      );
    });

    const billPaymentDocRef = build5Db().doc(COL.TRANSACTION, stake.billPaymentId);
    await wait(async () => {
      const billPayment = <Transaction>await billPaymentDocRef.get();
      return billPayment.payload.walletReference?.confirmed;
    });
    const billPayment = <Transaction>await billPaymentDocRef.get();
    expect(Number(billPayment.payload.nativeTokens![0].amount)).toBe(stake.amount);
    expect(billPayment.payload.targetAddress).toBe(address.bech32);
    expect(billPayment.payload.type).toBe(TransactionPayloadType.STAKE);
    expect(billPayment.payload.token).toBe(this.token!.uid);
    expect(billPayment.payload.tokenSymbol).toBe(this.token!.symbol);

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
      await build5Db().doc(COL.TOKEN, this.token!.uid, SUB_COL.STATS, this.token?.uid).get()
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
    const distribution = <TokenDistribution>await build5Db()
      .doc(COL.TOKEN, this.token!.uid, SUB_COL.DISTRIBUTION, member || this.member!.uid)
      .get();
    expect(distribution.stakes![type].amount).toBe(stakeAmount);
    expect(distribution.stakes![type].totalAmount).toBe(stakeTotalAmount);
    expect(distribution.stakes![type].value).toBe(stakeValue);
    expect(distribution.stakes![type].totalValue).toBe(stakeTotalValue);
  };

  public assertDistributionStakeExpiry = async (stake: Stake) => {
    const distributionDocRef = build5Db().doc(
      COL.TOKEN,
      this.token?.uid!,
      SUB_COL.DISTRIBUTION,
      this.member!.uid,
    );
    const distirbution = <TokenDistribution>await distributionDocRef.get();
    expect(distirbution.stakeExpiry![stake.type][stake.expiresAt.toMillis()]).toBe(stake.value);
  };

  public updateStakeExpiresAt = async (stake: Stake, expiresAt: dayjs.Dayjs) => {
    await build5Db().doc(COL.STAKE, stake.uid).update({ expiresAt: expiresAt.toDate() });
    const distributionDocRef = build5Db().doc(
      COL.TOKEN,
      this.token?.uid!,
      SUB_COL.DISTRIBUTION,
      this.member!.uid,
    );

    await distributionDocRef.update({
      stakeExpiry: { [stake.type]: { [stake.expiresAt.toMillis()]: null } },
    });
    await distributionDocRef.update({
      stakeExpiry: {
        [stake.type]: { [dateToTimestamp(expiresAt.toDate()).toMillis()]: stake.value },
      },
    });
  };

  public assertStakeExpiryCleared = async (type: StakeType) => {
    const distributionDocRef = build5Db().doc(
      COL.TOKEN,
      this.token?.uid!,
      SUB_COL.DISTRIBUTION,
      this.member!.uid,
    );
    const distribution = <TokenDistribution>await distributionDocRef.get();
    expect(isEmpty(distribution.stakeExpiry![type])).toBe(true);
  };
}
