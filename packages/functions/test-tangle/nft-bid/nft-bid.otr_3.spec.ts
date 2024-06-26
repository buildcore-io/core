import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftBidTangleRequest,
  TangleRequestType,
  Transaction,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { finalizeAuctions } from '../../src/cron/auction.cron';
import { IotaWallet } from '../../src/services/wallet/IotaWalletService';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Nft otr bid', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.beforeAll();
    tangleOrder = await getTangleOrder(Network.ATOI);
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should bid on minted nft with ATOI otr, no withdraw', async () => {
    const atoiWallet = (await getWallet(Network.ATOI)) as IotaWallet;
    const atoiAddress = await atoiWallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.ATOI, atoiAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.createAndOrderNft();
    await helper.setAvailableForAuction();

    await atoiWallet.send(atoiAddress, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_BID,
          nft: helper.nft.uid,
        } as NftBidTangleRequest,
      },
    });
    await MnemonicService.store(atoiAddress.bech32, atoiAddress.mnemonic, Network.RMS);
    const nftDocRef = database().doc(COL.NFT, helper.nft!.uid);
    await wait(async () => {
      const nft = await nftDocRef.get();
      return !isEmpty(nft?.auctionHighestBidder);
    });

    await database()
      .doc(COL.AUCTION, helper.nft!.auction!)
      .update({ auctionTo: dayjs().subtract(1, 'm').toDate() });

    await finalizeAuctions();

    await wait(async () => {
      const nft = <Nft>await database().doc(COL.NFT, helper.nft!.uid).get();
      return nft.owner === atoiAddress.bech32;
    });
  });
});
