import { IndexerPluginClient, INftOutput, NFT_OUTPUT_TYPE } from '@iota/iota.js-next';
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { withdrawNft } from '../../src/runtime/firebase/nft/index';
import { openBid } from '../../src/controls/order.control';
import { finalizeAllNftAuctions } from '../../src/cron/nft.cron';
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

  it.each([false, true])(
    'Should bid twice on minted nft and withdraw it',
    async (hasExpiration: boolean) => {
      await helper.createAndOrderNft();
      await helper.mintCollection();

      await helper.setAvailableForAuction();

      mockWalletReturnValue(helper.walletSpy, helper.member!, { nft: helper.nft!.uid });
      await expectThrow(testEnv.wrap(withdrawNft)({}), WenError.you_must_be_the_owner_of_nft.key);

      const expiresAt = hasExpiration ? dateToTimestamp(dayjs().add(2, 'h').toDate()) : undefined;

      mockWalletReturnValue(helper.walletSpy, helper.member!, { nft: helper.nft!.uid });
      const bidOrder = await testEnv.wrap(openBid)({});
      await requestFundsFromFaucet(
        Network.RMS,
        bidOrder.payload.targetAddress,
        MIN_IOTA_AMOUNT,
        expiresAt,
      );

      await wait(async () => {
        const nft = <Nft>(
          (await admin.firestore().doc(`${COL.NFT}/${helper.nft!.uid}`).get()).data()
        );
        return !isEmpty(nft.auctionHighestTransaction);
      });

      const bidOrder2 = await testEnv.wrap(openBid)({});
      await requestFundsFromFaucet(
        Network.RMS,
        bidOrder2.payload.targetAddress,
        2 * MIN_IOTA_AMOUNT,
        expiresAt,
      );

      await wait(async () => {
        const nft = <Nft>(
          (await admin.firestore().doc(`${COL.NFT}/${helper.nft!.uid}`).get()).data()
        );

        const payment = (
          await admin
            .firestore()
            .collection(COL.TRANSACTION)
            .where('type', '==', TransactionType.PAYMENT)
            .where('payload.sourceTransaction', 'array-contains', bidOrder2.uid)
            .get()
        ).docs[0]?.data() as Transaction;
        return nft.auctionHighestTransaction === payment?.uid;
      });

      await admin
        .firestore()
        .doc(`${COL.NFT}/${helper.nft!.uid}`)
        .update({ auctionTo: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });

      await finalizeAllNftAuctions();

      await wait(async () => {
        const nft = <Nft>(
          (await admin.firestore().doc(`${COL.NFT}/${helper.nft!.uid}`).get()).data()
        );
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
    },
  );
});
