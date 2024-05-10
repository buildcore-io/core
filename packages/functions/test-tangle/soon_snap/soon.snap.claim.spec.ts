import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  Transaction,
} from '@buildcore/interfaces';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

describe('Soon snapshot claim', () => {
  let tangleOrder: Transaction;

  beforeAll(async () => {
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  it('Claim soon snap with single eth address', async () => {
    const wallet = await getWallet(Network.RMS);
    const address = await wallet.getNewIotaAddressDetails();

    await requestFundsFromFaucet(Network.RMS, address.bech32, MIN_IOTA_AMOUNT);

    const ethAddress = ['0x69252ebdc3b77624c6e640a81a086aaa720734d3'];

    const soonSnaps = [
      { uid: address.bech32, count: 12, paidOut: 0, ethAddress: '', ethAddressVerified: false },
    ];
    await database().getCon()(COL.SOON_SNAP).insert(soonSnaps);

    await wallet.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.VERIFY_ETH_ADDRESS,
          ethAddress: ethAddress.join(','),
        },
      },
    });

    await wait(async () => {
      const soonSnaps = await database().collection(COL.SOON_SNAP).whereIn('uid', ethAddress).get();
      return soonSnaps.reduce((acc, act) => acc && act.ethAddressVerified, true);
    });
  });

  it('Claim soon snap with multiple eth address', async () => {
    const wallet = await getWallet(Network.RMS);
    const address = await wallet.getNewIotaAddressDetails();

    await requestFundsFromFaucet(Network.RMS, address.bech32, MIN_IOTA_AMOUNT);

    const ethAddress = [
      '0x69252ebdc3b77624c6e640a81a086aaa720734d3',
      getRandomEthAddress(),
      getRandomEthAddress(),
    ];

    const soonSnaps = [
      { uid: address.bech32, count: 12, paidOut: 0, ethAddress: '', ethAddressVerified: false },
      { uid: ethAddress[1], count: 12, paidOut: 0, ethAddress: '', ethAddressVerified: false },
      { uid: ethAddress[2], count: 12, paidOut: 0, ethAddress: '', ethAddressVerified: false },
    ];
    await database().getCon()(COL.SOON_SNAP).insert(soonSnaps);

    await wallet.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.VERIFY_ETH_ADDRESS,
          ethAddress: ethAddress.join(','),
        },
      },
    });

    await wait(async () => {
      const soonSnaps = await database().collection(COL.SOON_SNAP).whereIn('uid', ethAddress).get();
      return soonSnaps.reduce((acc, act) => acc && act.ethAddressVerified, true);
    });
  });
});
