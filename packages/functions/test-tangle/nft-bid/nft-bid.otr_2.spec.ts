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
import { isEmpty } from 'lodash';
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
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should bid on minted nft with OTR, no withdraw', async () => {
    const address = await helper.walletService!.getNewIotaAddressDetails();
    requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.createAndOrderNft();
    await helper.mintCollection();
    await helper.setAvailableForAuction();

    await helper.walletService!.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
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
      return !isEmpty(nft?.auctionHighestTransaction);
    });

    await build5Db()
      .doc(`${COL.NFT}/${helper.nft!.uid}`)
      .update({ auctionTo: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });

    await finalizeAllNftAuctions();

    await wait(async () => {
      const nft = <Nft>await build5Db().doc(`${COL.NFT}/${helper.nft!.uid}`).get();
      return nft.owner === address.bech32;
    });
  });
});
