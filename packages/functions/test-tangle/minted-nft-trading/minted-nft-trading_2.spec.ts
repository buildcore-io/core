import { IndexerPluginClient, INftOutput, NFT_OUTPUT_TYPE } from '@iota/iota.js-next';
import {
  COL,
  Member,
  Network,
  Nft,
  NftStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { withdrawNft } from '../../src/controls/nft/nft.control';
import { orderNft } from '../../src/controls/order.control';
import { getAddress } from '../../src/utils/address.utils';
import { Bech32AddressHelper } from '../../src/utils/bech32-address.helper';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted nft trading', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([false, true])('Should order nft and withdraaw it', async (hasExpiration: boolean) => {
    const expiresAt = hasExpiration ? dateToTimestamp(dayjs().add(2, 'h').toDate()) : undefined;

    await helper.createAndOrderNft();
    await helper.mintCollection(expiresAt);

    await helper.setAvailableForSale();

    mockWalletReturnValue(helper.walletSpy, helper.member!, { nft: helper.nft!.uid });
    await expectThrow(testEnv.wrap(withdrawNft)({}), WenError.you_must_be_the_owner_of_nft.key);

    mockWalletReturnValue(helper.walletSpy, helper.member!, {
      collection: helper.collection!,
      nft: helper.nft!.uid,
    });
    const order = await testEnv.wrap(orderNft)({});
    requestFundsFromFaucet(
      Network.RMS,
      order.payload.targetAddress,
      order.payload.amount,
      expiresAt,
    );

    await wait(async () => {
      const nft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${helper.nft!.uid}`).get()).data();
      return nft.owner === helper.member;
    });

    mockWalletReturnValue(helper.walletSpy, helper.member!, { nft: helper.nft!.uid });
    await testEnv.wrap(withdrawNft)({});

    const nft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${helper.nft!.uid}`).get()).data();
    expect(nft.status).toBe(NftStatus.WITHDRAWN);

    await wait(async () => {
      const transaction = (
        await admin
          .firestore()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.WITHDRAW_NFT)
          .where('payload.nft', '==', helper.nft!.uid)
          .get()
      ).docs[0]?.data() as Transaction;
      return transaction?.payload?.walletReference?.confirmed;
    });

    const indexer = new IndexerPluginClient(helper.walletService?.client!);
    const output = (
      await helper.walletService!.client.output(
        (
          await indexer.nft(nft.mintingData?.nftId!)
        ).items[0],
      )
    ).output;
    const ownerAddress = Bech32AddressHelper.addressFromAddressUnlockCondition(
      (output as INftOutput).unlockConditions,
      'rms',
      NFT_OUTPUT_TYPE,
    );
    const member = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.member}`).get()).data()
    );
    expect(ownerAddress).toBe(getAddress(member, Network.RMS));
  });
});
