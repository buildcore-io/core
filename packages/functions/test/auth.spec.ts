import { Ed25519, Ed25519 as Ed25519Next } from '@iota/crypto.js-next';
import { Converter, Converter as ConverterNext } from '@iota/util.js-next';
import { COL, Member, Network, WenError, WEN_FUNC } from '@soonaverse/interfaces';
import jwt from 'jsonwebtoken';
import { get } from 'lodash';
import admin from '../src/admin.config';
import { generateCustomFirebaseToken } from '../src/controls/auth.control';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { WalletService } from '../src/services/wallet/wallet';
import * as config from '../src/utils/config.utils';
import { getJwtSecretKey } from '../src/utils/config.utils';
import * as wallet from '../src/utils/wallet.utils';
import { decodeAuth, getRandomNonce } from '../src/utils/wallet.utils';
import { createMember, expectThrow, mockWalletReturnValue } from './controls/common';
import { testEnv } from './set-up';

describe('Auth control test', () => {
  let walletSpy: jest.SpyInstance;
  let configSpy: jest.SpyInstance;
  let member: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
  });

  it('Should create and reuse custom token', async () => {
    mockWalletReturnValue(walletSpy, member, {});
    const token = await testEnv.wrap(generateCustomFirebaseToken)({});
    walletSpy.mockRestore();

    const tokenGeneratedWithToken = await testEnv.wrap(generateCustomFirebaseToken)({
      address: member,
      customToken: token,
      body: {},
    });
    expect(tokenGeneratedWithToken).toBeDefined();
    const decoded = jwt.verify(tokenGeneratedWithToken, getJwtSecretKey());
    expect(get(decoded, 'uid')).toBe(member);
    expect(get(decoded, 'iat')).toBeDefined();
    expect(get(decoded, 'exp')).toBeDefined();
  });

  it('Should throw, custom token for func expired', async () => {
    mockWalletReturnValue(walletSpy, member, {});
    const token = await testEnv.wrap(generateCustomFirebaseToken)({});
    walletSpy.mockRestore();

    configSpy = jest.spyOn(config, 'getCustomTokenLifetime');
    configSpy.mockReturnValue(1);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expectThrow(
      testEnv.wrap(generateCustomFirebaseToken)({
        address: member,
        customToken: token,
        body: {},
      }),
      WenError.invalid_custom_token.key,
    );

    configSpy.mockRestore();
  });
});

describe('Pub key test', () => {
  it.each([Network.RMS, Network.SMR])('Should validate SMR pub key', async (network: Network) => {
    const wallet = (await WalletService.newWallet(network)) as SmrWallet;
    const address = await wallet.getNewIotaAddressDetails();

    const nonce = getRandomNonce();
    const userDocRef = admin.firestore().doc(`${COL.MEMBER}/${address.bech32}`);
    await userDocRef.create({ uid: address.bech32, nonce });

    const signature = Ed25519Next.sign(
      address.keyPair.privateKey,
      Converter.utf8ToBytes(`0x${toHex(nonce)}`),
    );
    const request = {
      address: 'address',
      signature: ConverterNext.bytesToHex(signature),
      publicKey: {
        hex: ConverterNext.bytesToHex(address.keyPair.publicKey),
        network,
      },
      body: {},
    };

    const result = await decodeAuth(request, WEN_FUNC.aProposal);

    expect(result.address).toBe(address.bech32);

    const user = <Member>(await userDocRef.get()).data();
    expect(user.validatedAddress![network]).toBe(address.bech32);
  });

  it.each([Network.IOTA, Network.ATOI])(
    'Should validate IOTA pub key',
    async (network: Network) => {
      const wallet = (await WalletService.newWallet(network)) as SmrWallet;
      const address = await wallet.getNewIotaAddressDetails();

      const nonce = getRandomNonce();
      const userDocRef = admin.firestore().doc(`${COL.MEMBER}/${address.bech32}`);
      await userDocRef.create({ uid: address.bech32, nonce });

      const signature = Ed25519.sign(
        address.keyPair.privateKey,
        Converter.utf8ToBytes(`0x${toHex(nonce)}`),
      );

      const request = {
        address: 'address',
        signature: Converter.bytesToHex(signature),
        publicKey: {
          hex: Converter.bytesToHex(address.keyPair.publicKey),
          network,
        },
        body: {},
      };

      const result = await decodeAuth(request, WEN_FUNC.aProposal);

      expect(result.address).toBe(address.bech32);

      const user = <Member>(await userDocRef.get()).data();
      expect(user.validatedAddress![network]).toBe(address.bech32);
    },
  );
});

const toHex = (stringToConvert: string) =>
  stringToConvert
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
