import { database, storage } from '@buildcore/database';
import {
  Bucket,
  COL,
  Network,
  SOON_PROJECT_ID,
  STAMP_COST_PER_MB,
  SUB_COL,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { EMPTY_ALIAS_ID } from '../../src/utils/token-minting-utils/alias.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { mockWalletReturnValue, testEnv } from '../set-up';

describe('Stamp control', () => {
  let member: string;
  let dowloadUrl: string;

  beforeEach(async () => {
    const bucket = storage().bucket(Bucket.TEST);
    const destination = `nft/${wallet.getRandomEthAddress()}/image.jpeg`;
    await bucket.upload('./test/puppy.jpeg', destination, {
      contentType: 'image/jpeg',
    });
    dowloadUrl = `https://${bucket.getName()}/${destination}`;
    member = await testEnv.createMember();
  });

  it('Should create stamp order', async () => {
    mockWalletReturnValue(member, { network: Network.RMS, file: dowloadUrl });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.stamp);
    expect(order.project).toBe(SOON_PROJECT_ID);
    expect(order.type).toBe(TransactionType.ORDER);
    expect(order.member).toBe(member);
    expect(order.space).toBeDefined();
    expect(order.member).toBe(member);
    expect(order.network).toBe(Network.RMS);
    expect(order.payload.type).toBe(TransactionPayloadType.STAMP);
    expect(order.payload.validationType).toBe(TransactionValidationType.ADDRESS);
    expect(order.payload.stamp).toBeDefined();
    expect(order.payload.aliasId).toBe('');
    expect(order.payload.aliasOutputAmount).toBe(53700);
    expect(order.payload.nftOutputAmount).toBe(92000);

    const stampDocRef = database().doc(COL.STAMP, order.payload.stamp!);
    const stamp = await stampDocRef.get();
    expect(stamp?.space).toBe(order.space);
    expect(stamp?.build5Url).toBe(dowloadUrl);
    expect(stamp?.originUri).toBe(dowloadUrl);
    expect(stamp?.costPerMb).toBe(STAMP_COST_PER_MB);
    expect(stamp?.network).toBe(Network.RMS);
    expect(stamp?.ipfsMedia).toBeDefined();
    expect(stamp?.expiresAt).toBeDefined();
    expect(stamp?.order).toBe(order.uid);
    expect(stamp?.funded).toBe(false);
    expect(stamp?.expired).toBe(false);
    expect(stamp?.aliasId).toBe(EMPTY_ALIAS_ID);
    expect(stamp?.nftId).toBeUndefined();

    const guardianDocRef = database().doc(COL.SPACE, order.space!, SUB_COL.GUARDIANS, member);
    const guardian = await guardianDocRef.get();
    expect(guardian).toBeDefined();
  });
});
