/* eslint-disable @typescript-eslint/no-explicit-any */
import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import {
  Member,
  Network,
  Space,
  Token,
  TokenStatus,
  TokenTradeOrderType,
  Transaction,
} from '../../interfaces/models';
import { COL, Timestamp } from '../../interfaces/models/base';
import admin from '../../src/admin.config';
import { tradeToken } from '../../src/controls/token-trading/token-trade.controller';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember,
  createRoyaltySpaces,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { MilestoneListener } from '../db-sync.utils';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

export class Helper {
  public network = Network.RMS;
  public seller: string | undefined;
  public listener: MilestoneListener | undefined;
  public space: Space | undefined;
  public token: Token | undefined;
  public sellerAddress: AddressDetails | undefined;
  public buyer: string | undefined;
  public buyerAddress: AddressDetails | undefined;

  public guardian: string | undefined;
  public walletService: SmrWallet | undefined;
  public walletSpy: any;

  public berforeAll = async () => {
    this.walletService = (await WalletService.newWallet(this.network)) as SmrWallet;
    await createRoyaltySpaces();
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.listener = new MilestoneListener(this.network);
  };

  public beforeEach = async () => {
    this.guardian = await createMember(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian);
    this.token = (await saveToken(this.space.uid, this.guardian, this.walletService!)) as Token;

    this.seller = await createMember(this.walletSpy);
    const sellerDoc = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${this.seller}`).get()).data()
    );
    this.sellerAddress = await this.walletService!.getAddressDetails(
      getAddress(sellerDoc, this.network!),
    );
    await requestFundsFromFaucet(this.network, this.sellerAddress.bech32, 20 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      this.walletService!,
      this.sellerAddress,
      this.token.mintingData?.tokenId!,
      VAULT_MNEMONIC,
    );

    this.buyer = await createMember(this.walletSpy);
    const buyerDoc = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${this.buyer}`).get()).data()
    );
    this.buyerAddress = await this.walletService!.getAddressDetails(
      getAddress(buyerDoc, this.network),
    );
  };

  public createSellTradeOrder = async (
    count = 10,
    price = MIN_IOTA_AMOUNT,
    expiresAt?: Timestamp,
  ) => {
    mockWalletReturnValue(this.walletSpy, this.seller!, {
      token: this.token!.uid,
      count,
      price,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder: Transaction = await testEnv.wrap(tradeToken)({});
    await this.walletService!.send(this.sellerAddress!, sellOrder.payload.targetAddress, 0, {
      nativeTokens: [
        { amount: HexHelper.fromBigInt256(bigInt(count)), id: this.token!.mintingData?.tokenId! },
      ],
      expiration: expiresAt
        ? {
            expiresAt,
            returnAddressBech32: this.sellerAddress!.bech32,
          }
        : undefined,
    });
    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('orderTransactionId', '==', sellOrder.uid)
        .get();
      return snap.size === 1;
    });
    await MnemonicService.store(
      this.sellerAddress!.bech32,
      this.sellerAddress!.mnemonic,
      this.network!,
    );
    return sellOrder;
  };

  public createBuyOrder = async (count = 10, price = MIN_IOTA_AMOUNT, expiresAt?: Timestamp) => {
    mockWalletReturnValue(this.walletSpy, this.buyer!, {
      token: this.token!.uid,
      count,
      price,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder: Transaction = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      this.network,
      buyOrder.payload.targetAddress,
      buyOrder.payload.amount,
      expiresAt,
    );
    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('orderTransactionId', '==', buyOrder.uid)
        .get();
      return snap.size === 1;
    });
    return buyOrder;
  };
}

export const saveToken = async (
  space: string,
  guardian: string,
  walletService: SmrWallet,
  tokenId = MINTED_TOKEN_ID,
) => {
  const vaultAddress = await walletService.getIotaAddressDetails(VAULT_MNEMONIC);
  await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic);
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
      tokenId,
      network: Network.RMS,
      vaultAddress: vaultAddress.bech32,
    },
    access: 0,
  };
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token;
};

export const dummyTokenId =
  '0x080c409a8c0ffa795676e55f24e0223e5b48dbe2b1bc4314140333543b5e7e8d360100000000';

export const VAULT_MNEMONIC =
  'offer kingdom rate never hurt follow wrestle cloud alien admit bird usage avoid cloth soldier evidence crawl harsh electric wheat ten mushroom glare reject';

export const MINTED_TOKEN_ID =
  '0x085f6308dd034c70ea90b4e2600c4f8fb65d0b53504a0d96e37ce8641a8835d2110100000000';
