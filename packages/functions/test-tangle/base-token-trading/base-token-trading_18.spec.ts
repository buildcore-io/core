import { database } from '@buildcore/database';
import { COL, MIN_IOTA_AMOUNT, Network, TangleRequestType } from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const h = new Helper();

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should create market sell with tangle request for RMS', async () => {
    const tangleOrder = await getTangleOrder(Network.RMS);

    const address = h.sellerValidateAddress![Network.RMS];

    await requestFundsFromFaucet(Network.RMS, address.bech32, MIN_IOTA_AMOUNT);

    await h.rmsWallet!.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: { request: { requestType: TangleRequestType.SELL_TOKEN } },
    });

    const query = database().collection(COL.TOKEN_MARKET).where('owner', '==', h.seller?.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const order = (await query.get())[0];
    expect(order.sourceNetwork).toBe(Network.RMS);
    expect(order.targetNetwork).toBe(Network.ATOI);
  });
});
