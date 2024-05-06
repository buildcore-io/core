import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import { getAddress } from '../../src/utils/address.utils';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Nft transfer', () => {
  const h = new Helper();
  let tangleOrder: Transaction;

  beforeEach(async () => {
    await h.beforeAll();
  });

  beforeEach(async () => {
    await h.beforeEach();
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  it('Should transfer with to random address', async () => {
    const nft1 = await h.createAndOrderNft();
    const nft2 = await h.createAndOrderNft();
    await h.mintCollection();

    const targetAddress = await h.walletService.getNewIotaAddressDetails();

    const guardianDocRef = database().doc(COL.MEMBER, h.guardian);
    const guardian = await guardianDocRef.get();
    const bech32 = getAddress(guardian, Network.RMS);
    const address = await h.walletService.getAddressDetails(bech32);

    await requestFundsFromFaucet(Network.RMS, bech32, MIN_IOTA_AMOUNT);

    await h.walletService.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_TRANSFER,
          transfers: [
            { nft: nft1.uid, target: targetAddress.bech32 },
            { nft: nft2.uid, target: targetAddress.bech32 },
          ],
        },
      },
    });

    let query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.guardian)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const credit = (await query.get())[0];
    expect(credit.payload.response![nft1.uid]).toBe(200);
    expect(credit.payload.response![nft2.uid]).toBe(200);

    query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.guardian)
      .where('type', '==', TransactionType.WITHDRAW_NFT);
    await wait(async () => {
      const withdraws = await query.get();
      return (
        withdraws.length === 2 &&
        withdraws[0].payload.walletReference?.confirmed &&
        withdraws[1].payload.walletReference?.confirmed
      );
    });

    const nfts = await h.walletService.client.nftOutputIds([{ address: targetAddress.bech32 }]);
    expect(nfts.items.length).toBe(2);
  });
});
