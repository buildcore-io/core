import { database, storage } from '@buildcore/database';
import {
  Bucket,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  StampTangleRequest,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import crypto from 'crypto';
import fs from 'fs';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public tangleOrder: Transaction = {} as any;
  public wallet: SmrWallet = {} as any;
  public address: AddressDetails = {} as any;
  public dowloadUrl = '';
  public checksum = '';

  public request: StampTangleRequest = {} as any;
  public beforeAll = async () => {
    this.tangleOrder = await getTangleOrder(Network.RMS);
    this.wallet = (await getWallet(Network.RMS)) as SmrWallet;
  };

  public beforeEach = async () => {
    const bucket = storage().bucket(Bucket.TEST);
    const destination = `nft/${getRandomEthAddress()}/image.jpeg`;
    await bucket.upload('./test/puppy.jpeg', destination, {
      contentType: 'image/jpeg',
    });
    this.dowloadUrl = `https://${bucket.getName()}/${destination}`;

    this.request = { requestType: TangleRequestType.STAMP, uri: this.dowloadUrl };
    const content = fs.readFileSync('./test/puppy.jpeg');
    this.checksum = crypto
      .createHash('sha1')
      .update('' + content)
      .digest('hex');

    this.address = await this.wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, this.address.bech32, 5 * MIN_IOTA_AMOUNT);
  };

  public getCreditResponse = async () => {
    const query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', this.address.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0].payload.walletReference?.confirmed === true;
    });

    const credit = (await query.get())[0];
    return credit.payload.response!;
  };
}
