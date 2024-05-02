import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  NftSetForSaleTangleRequest,
  TangleRequestType,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Nft set for sale OTR', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.beforeAll();
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should credit, not owner', async () => {
    await helper.createAndOrderNft();

    const address = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

    const saleData = helper.dummySaleData(helper.nft.uid);
    await helper.walletService!.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_SET_FOR_SALE,
          ...saleData,
        } as NftSetForSaleTangleRequest,
      },
    });

    const credit = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', address.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await credit.get();
      return snap.length === 1 && snap[0].payload?.walletReference?.confirmed;
    });

    const snap = await credit.get();
    expect(snap[0].payload.response!['code']).toBe(WenError.you_must_be_the_owner_of_nft.code);
  });
});
