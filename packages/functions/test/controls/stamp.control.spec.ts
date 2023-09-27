import { build5Db, build5Storage } from '@build-5/database';
import {
  Bucket,
  COL,
  Network,
  SOON_PROJECT_ID,
  STAMP_COST_PER_MB,
  SUB_COL,
  SpaceGuardian,
  Stamp,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@build-5/interfaces';
import { stamp as stampFunc } from '../../src/runtime/firebase/stamp';
import { EMPTY_ALIAS_ID } from '../../src/utils/token-minting-utils/alias.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { createMember, mockWalletReturnValue } from './common';

describe('Stamp control', () => {
  let walletSpy: any;
  let member: string;
  let dowloadUrl: string;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  });

  beforeEach(async () => {
    const bucket = build5Storage().bucket(Bucket.DEV);
    const destination = `nft/${wallet.getRandomEthAddress()}/image.jpeg`;
    dowloadUrl = await bucket.upload('./test/puppy.jpeg', destination, {
      contentType: 'image/jpeg',
    });
    member = await createMember(walletSpy);
  });

  it('Should create stamp order', async () => {
    mockWalletReturnValue(walletSpy, member, { network: Network.RMS, file: dowloadUrl });
    const order = (await testEnv.wrap(stampFunc)({})) as Transaction;
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
    expect(order.payload.nftOutputAmount).toBe(65400);

    const stampDocRef = build5Db().doc(`${COL.STAMP}/${order.payload.stamp}`);
    const stamp = await stampDocRef.get<Stamp>();
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

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${order.space}`);
    const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member);
    const guardian = await guardianDocRef.get<SpaceGuardian>();
    expect(guardian).toBeDefined();
  });
});
