import { build5Db } from '@build-5/database';
import { COL, MIN_IOTA_AMOUNT, Network, TangleRequestType } from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const h = new Helper();

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should buy with tangle request for RMS', async () => {
    const tangleOrder = await getTangleOrder(Network.ATOI);

    const address = h.buyerValidateAddress![Network.ATOI];

    await requestFundsFromFaucet(Network.ATOI, address.bech32, MIN_IOTA_AMOUNT);

    await h.rmsWallet!.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: { requestType: TangleRequestType.BUY_TOKEN, count: 1, price: MIN_IOTA_AMOUNT },
      },
    });

    const query = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', h.buyer?.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const order = (await query.get())[0];
    expect(order.sourceNetwork).toBe(Network.ATOI);
    expect(order.targetNetwork).toBe(Network.RMS);
  });
});
