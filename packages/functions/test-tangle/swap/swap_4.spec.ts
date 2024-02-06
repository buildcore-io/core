import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Swap,
  SwapStatus,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper, MINTED_TOKEN_ID_1, MINTED_TOKEN_ID_2 } from './Helper';

describe('Swap control test', () => {
  const h = new Helper();

  beforeAll(async () => {
    await h.beforeAll();
  });

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should create swap with OTR, set funded', async () => {
    const tangleOrder = await getTangleOrder(h.network);

    const request = {
      requestType: TangleRequestType.CREATE_SWAP,
      nativeTokens: [
        { id: MINTED_TOKEN_ID_1, amount: 5 },
        { id: MINTED_TOKEN_ID_2, amount: 5 },
      ],
      recipient: h.member,
      setFunded: true,
    };

    const address = await h.wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(h.network, address.bech32, MIN_IOTA_AMOUNT);

    await h.wallet.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: { request },
    });

    let query = build5Db().collection(COL.SWAP).where('createdBy', '==', address.bech32);
    await wait(async () => {
      const snap = await query.get<Swap>();
      return snap.length === 1;
    });
    const swap = (await query.get<Swap>())[0];
    expect(swap.bidOutputs?.length).toBe(1);
    expect(swap.bidOutputs![0].amount).toBe(MIN_IOTA_AMOUNT);
    expect(swap.status).toBe(SwapStatus.FUNDED);
    expect(swap.nativeTokensAsk.map((nt) => nt.id).sort()).toEqual(
      [MINTED_TOKEN_ID_1, MINTED_TOKEN_ID_2].sort(),
    );

    query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', address.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    const snap = await query.get<Transaction>();
    expect(snap.length).toBe(0);
  });
});
