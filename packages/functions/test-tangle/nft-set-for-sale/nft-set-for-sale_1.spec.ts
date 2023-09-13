import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftAvailable,
  NftSetForSaleTangleRequest,
  TangleRequestType,
  Transaction,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Nft set for sale OTR', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.beforeAll();
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should set nft for sale with OTR', async () => {
    await helper.createAndOrderNft();

    await requestFundsFromFaucet(Network.RMS, helper.guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    const saleData = helper.dummySaleData(helper.nft.uid);
    await helper.walletService!.send(
      helper.guardianAddress,
      tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.NFT_SET_FOR_SALE,
            ...saleData,
          } as NftSetForSaleTangleRequest,
        },
      },
    );

    const nftDocRef = build5Db().doc(`${COL.NFT}/${helper.nft.uid}`);
    await wait(async () => {
      helper.nft = (await nftDocRef.get<Nft>())!;
      return helper.nft.available === NftAvailable.SALE;
    });
  });

  it('Should set nft for auction with OTR', async () => {
    await helper.createAndOrderNft();

    await requestFundsFromFaucet(Network.RMS, helper.guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    const auctionData = helper.dummyAuctionData(helper.nft.uid);
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

    const nftDocRef = build5Db().doc(`${COL.NFT}/${helper.nft.uid}`);
    await wait(async () => {
      helper.nft = (await nftDocRef.get<Nft>())!;
      return helper.nft.available === NftAvailable.AUCTION_AND_SALE;
    });
  });
});
