import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
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

  it('Should transfer with OTR', async () => {
    const nft1 = await h.createAndOrderNft();
    const nft2 = await h.createAndOrderNft();
    await h.mintCollection();

    const guardianDocRef = build5Db().doc(COL.MEMBER, h.guardian);
    const guardian = await guardianDocRef.get();
    const bech32 = getAddress(guardian, Network.RMS);
    const address = await h.walletService.getAddressDetails(bech32);

    await requestFundsFromFaucet(Network.RMS, bech32, MIN_IOTA_AMOUNT);

    await h.walletService.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_TRANSFER,
          transfers: [
            { nft: nft1.uid, target: h.member },
            { nft: nft2.uid, target: h.member },
          ],
        },
      },
    });

    const query = build5Db()
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
  });
});
