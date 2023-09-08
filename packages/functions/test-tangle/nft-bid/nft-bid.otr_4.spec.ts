import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftBidTangleRequest,
  TangleRequestType,
  Transaction,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { finalizeAllNftAuctions } from '../../src/cron/nft.cron';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Nft otr bid', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.beforeAll();
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should bid twice on minted nft with OTR', async () => {
    const address1 = await helper.walletService!.getNewIotaAddressDetails();
    requestFundsFromFaucet(Network.RMS, address1.bech32, 5 * MIN_IOTA_AMOUNT);
    const address2 = await helper.walletService!.getNewIotaAddressDetails();
    requestFundsFromFaucet(Network.RMS, address2.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.createAndOrderNft();
    await helper.mintCollection();
    await helper.setAvailableForAuction();

    helper.walletService!.send(address1, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_BID,
          nft: helper.nft.uid,
          disableWithdraw: true,
        } as NftBidTangleRequest,
      },
    });

    helper.walletService!.send(address2, tangleOrder.payload.targetAddress!, 2 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_BID,
          nft: helper.nft.uid,
          disableWithdraw: true,
        } as NftBidTangleRequest,
      },
    });

    const nftDocRef = build5Db().doc(`${COL.NFT}/${helper.nft!.uid}`);
    await wait(async () => {
      const nft = await nftDocRef.get<Nft>();
      return nft?.auctionHighestBidder === address2.bech32;
    });

    await build5Db()
      .doc(`${COL.NFT}/${helper.nft!.uid}`)
      .update({ auctionTo: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });

    await finalizeAllNftAuctions();

    await wait(async () => {
      const nft = <Nft>await build5Db().doc(`${COL.NFT}/${helper.nft!.uid}`).get();
      return nft.owner === address2.bech32;
    });
  });
});
