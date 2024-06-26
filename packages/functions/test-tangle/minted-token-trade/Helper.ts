/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  SOON_PROJECT_ID,
  Space,
  Timestamp,
  Token,
  TokenStatus,
  TokenTradeOrderType,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';

import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createRoyaltySpaces, getRandomSymbol, wait } from '../../test/controls/common';
import { getWallet, MEDIA, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

export class Helper {
  public network = Network.RMS;
  public seller = '';
  public space: Space = {} as any;
  public token: Token = {} as any;
  public sellerAddress: AddressDetails = {} as any;
  public buyer = '';
  public buyerAddress: AddressDetails = {} as any;

  public guardian = '';
  public walletService: Wallet = {} as any;

  public berforeAll = async () => {
    this.walletService = await getWallet(this.network);
    await createRoyaltySpaces();
  };

  public beforeEach = async () => {
    this.guardian = await testEnv.createMember();
    this.space = await testEnv.createSpace(this.guardian);
    this.token = (await saveToken(this.space.uid, this.guardian, this.walletService!)) as Token;

    this.seller = await testEnv.createMember();
    const sellerDoc = <Member>await database().doc(COL.MEMBER, this.seller).get();
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

    this.buyer = await testEnv.createMember();
    const buyerDoc = <Member>await database().doc(COL.MEMBER, this.buyer).get();
    this.buyerAddress = await this.walletService!.getAddressDetails(
      getAddress(buyerDoc, this.network),
    );
  };

  public createSellTradeOrder = async (
    count = 10,
    price = MIN_IOTA_AMOUNT,
    expiresAt?: Timestamp,
  ) => {
    mockWalletReturnValue(this.seller!, {
      symbol: this.token!.symbol,
      count,
      price,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder: Transaction = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await this.walletService!.send(this.sellerAddress!, sellOrder.payload.targetAddress!, 0, {
      nativeTokens: [{ amount: BigInt(count), id: this.token!.mintingData?.tokenId! }],
      expiration: expiresAt
        ? {
            expiresAt,
            returnAddressBech32: this.sellerAddress!.bech32,
          }
        : undefined,
    });
    await wait(async () => {
      const snap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('orderTransactionId', '==', sellOrder.uid)
        .get();
      return snap.length === 1;
    });
    await MnemonicService.store(
      this.sellerAddress!.bech32,
      this.sellerAddress!.mnemonic,
      this.network!,
    );
    return sellOrder;
  };

  public createBuyOrder = async (count = 10, price = MIN_IOTA_AMOUNT, expiresAt?: Timestamp) => {
    mockWalletReturnValue(this.buyer!, {
      symbol: this.token!.symbol,
      count,
      price,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder: Transaction = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await requestFundsFromFaucet(
      this.network,
      buyOrder.payload.targetAddress!,
      buyOrder.payload.amount!,
      expiresAt,
    );
    await wait(async () => {
      const snap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('orderTransactionId', '==', buyOrder.uid)
        .get();
      return snap.length === 1;
    });
    return buyOrder;
  };
}

export const saveToken = async (
  space: string,
  guardian: string,
  walletService: Wallet,
  tokenId = MINTED_TOKEN_ID,
) => {
  const vaultAddress = await walletService.getIotaAddressDetails(VAULT_MNEMONIC);
  await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic);
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
      tokenId,
      network: Network.RMS,
      vaultAddress: vaultAddress.bech32,
    },
    access: 0,
    icon: MEDIA,
  } as Token;
  await database().doc(COL.TOKEN, token.uid).create(token);
  return token;
};

export const dummyTokenId =
  '0x080c409a8c0ffa795676e55f24e0223e5b48dbe2b1bc4314140333543b5e7e8d360100000000';

export const VAULT_MNEMONIC =
  'dad core rival blush concert cool aunt drum pupil youth original example issue around absent amused alley parrot blade intact visa noise slam slab';
export const MINTED_TOKEN_ID =
  '0x0808ee67386034f8c76b331745655a3eff500cb7ee0875f89213b2c826a20ddc570100000000';
