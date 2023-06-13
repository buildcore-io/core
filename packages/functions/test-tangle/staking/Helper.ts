/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BillPaymentType,
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
} from '@build-5/interfaces';
import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { depositStake } from '../../src/runtime/firebase/stake';
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
    this.member = <Member>await build5Db().doc(`${COL.MEMBER}/${memberId}`).get();
    this.memberAddress = await this.walletService?.getNewIotaAddressDetails();

    this.space = await createSpace(this.walletSpy, memberId);
    this.token = await this.saveToken(this.space!.uid, this.member!.uid);
    this.tokenStats = <TokenStats>(
      await build5Db()
        .doc(`${COL.TOKEN}/${this.token.uid}/${SUB_COL.STATS}/${this.token.uid}`)
        .get()
    );
    await requestFundsFromFaucet(this.network, this.memberAddress!.bech32, 10 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      this.walletService!,
      this.memberAddress!,
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
    await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
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
    const member = <Member>await build5Db()
      .doc(`${COL.MEMBER}/${memberUid || this.member?.uid}`)
      .get();
    mockWalletReturnValue(this.walletSpy, member.uid, {
      symbol: this.token?.symbol,
      weeks,
      type: type || StakeType.DYNAMIC,
      customMetadata,
    });
    const order = await testEnv.wrap(depositStake)({});
    const address = memberUid
      ? await this.walletService!.getAddressDetails(getAddress(member, Network.RMS))
      : this.memberAddress!;
    await this.walletService!.send(address, order.payload.targetAddress, order.payload.amount, {
      expiration: expiresAt
        ? { expiresAt, returnAddressBech32: this.memberAddress!.bech32 }
        : undefined,
      nativeTokens: [{ id: this.TOKEN_ID, amount: HexHelper.fromBigInt256(bigInt(amount)) }],
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
        await build5Db()
          .doc(`${COL.TOKEN}/${this.token?.uid}/${SUB_COL.STATS}/${this.token?.uid}`)
          .get()
      );
      return (
        (currTokenStats?.stakes || {})[type || StakeType.DYNAMIC]?.totalAmount !==
        (this.tokenStats?.stakes || {})[type || StakeType.DYNAMIC]?.totalAmount
      );
    });

    const billPaymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${stake.billPaymentId}`);
    await wait(async () => {
      const billPayment = <Transaction>await billPaymentDocRef.get();
      return billPayment.payload.walletReference?.confirmed;
    });
    const billPayment = <Transaction>await billPaymentDocRef.get();
    expect(billPayment.payload.nativeTokens[0].amount).toBe(stake.amount);
    expect(billPayment.payload.targetAddress).toBe(address.bech32);
    expect(billPayment.payload.type).toBe(BillPaymentType.STAKE);
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
      await build5Db()
        .doc(`${COL.TOKEN}/${this.token!.uid}/${SUB_COL.STATS}/${this.token?.uid}`)
        .get()
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
      .doc(`${COL.TOKEN}/${this.token!.uid}/${SUB_COL.DISTRIBUTION}/${member || this.member!.uid}`)
      .get();
    expect(distribution.stakes![type].amount).toBe(stakeAmount);
    expect(distribution.stakes![type].totalAmount).toBe(stakeTotalAmount);
    expect(distribution.stakes![type].value).toBe(stakeValue);
    expect(distribution.stakes![type].totalValue).toBe(stakeTotalValue);
  };

  public assertDistributionStakeExpiry = async (stake: Stake) => {
    const distributionDocRef = build5Db().doc(
      `${COL.TOKEN}/${this.token?.uid}/${SUB_COL.DISTRIBUTION}/${this.member!.uid}`,
    );
    const distirbution = <TokenDistribution>await distributionDocRef.get();
    expect(distirbution.stakeExpiry![stake.type][stake.expiresAt.toMillis()]).toBe(stake.value);
  };

  public updateStakeExpiresAt = async (stake: Stake, expiresAt: dayjs.Dayjs) => {
    await build5Db()
      .doc(`${COL.STAKE}/${stake.uid}`)
      .update({ expiresAt: dateToTimestamp(expiresAt.toDate()) });
    const distributionDocRef = build5Db().doc(
      `${COL.TOKEN}/${this.token?.uid}/${SUB_COL.DISTRIBUTION}/${this.member!.uid}`,
    );
    await distributionDocRef.set(
      {
        stakeExpiry: {
          [stake.type]: {
            [stake.expiresAt.toMillis()]: build5Db().deleteField(),
            [dateToTimestamp(expiresAt.toDate()).toMillis()]: stake.value,
          },
        },
      },
      true,
    );
  };

  public assertStakeExpiryCleared = async (type: StakeType) => {
    const distributionDocRef = build5Db().doc(
      `${COL.TOKEN}/${this.token?.uid}/${SUB_COL.DISTRIBUTION}/${this.member!.uid}`,
    );
    const distribution = <TokenDistribution>await distributionDocRef.get();
    expect(isEmpty(distribution.stakeExpiry![type])).toBe(true);
  };
}
