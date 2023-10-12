import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftAvailable,
  NftSetForSaleTangleRequest,
  TangleRequestType,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Nft set for acution OTR', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.beforeAll();
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should throw, nft auction already in progress', async () => {
    await helper.createAndOrderNft();

    await requestFundsFromFaucet(Network.RMS, helper.guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    let auctionData = helper.dummyAuctionData(
      helper.nft.uid,
      dayjs().add(1, 'h').toDate(),
      dayjs().add(1, 'h').toDate(),
    );
    await helper.walletService!.send(
      helper.guardianAddress,
      tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.NFT_SET_FOR_SALE,
            ...auctionData,
          } as NftSetForSaleTangleRequest,
        },
      },
    );
    await MnemonicService.store(helper.guardianAddress.bech32, helper.guardianAddress.mnemonic);

    const nftDocRef = build5Db().doc(`${COL.NFT}/${helper.nft.uid}`);
    await wait(async () => {
      helper.nft = (await nftDocRef.get<Nft>())!;
      return helper.nft.available === NftAvailable.AUCTION_AND_SALE;
    });

    auctionData = helper.dummyAuctionData(helper.nft.uid);
    await helper.walletService!.send(
      helper.guardianAddress,
      tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.NFT_SET_FOR_SALE,
            ...auctionData,
          } as NftSetForSaleTangleRequest,
        },
      },
    );
    await MnemonicService.store(helper.guardianAddress.bech32, helper.guardianAddress.mnemonic);

    const credit = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await credit.get<Transaction>();
      return snap.length === 2;
    });
    const succeses = (await credit.get<Transaction>()).filter(
      (t) => t.payload.response?.status === 'success',
    );
    expect(succeses.length).toBe(2);

    auctionData = helper.dummyAuctionData(helper.nft.uid);
    await helper.walletService!.send(
      helper.guardianAddress,
      tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.NFT_SET_FOR_SALE,
            ...auctionData,
          } as NftSetForSaleTangleRequest,
        },
      },
    );

    await wait(async () => {
      const snap = await credit.get<Transaction>();
      return snap.length === 3;
    });
    const snap = await credit.get<Transaction>();
    const creditTransction = snap.find(
      (t) => t.payload.response?.code === WenError.nft_auction_already_in_progress.code,
    );
    expect(creditTransction).toBeDefined();
  });
});