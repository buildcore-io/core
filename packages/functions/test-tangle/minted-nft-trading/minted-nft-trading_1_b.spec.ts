import { build5Db } from '@build-5/database';
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
} from '@build-5/interfaces';
import { NftOutput } from '@iota/sdk';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { finalizeAuctions } from '../../src/cron/auction.cron';
import { openBid, withdrawNft } from '../../src/runtime/firebase/nft/index';
import { getAddress } from '../../src/utils/address.utils';
import { Bech32AddressHelper } from '../../src/utils/bech32-address.helper';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted nft trading', () => {
  const helper = new Helper();

  it('Should bid twice on minted nft and withdraw it', async () => {
    await helper.beforeEach(Network.ATOI);
    await helper.createAndOrderNft();
    await helper.mintCollection();

    await helper.setAvailableForAuction();

    const nftDocRef = build5Db().doc(`${COL.NFT}/${helper.nft!.uid}`);

    mockWalletReturnValue(helper.walletSpy, helper.member!, { nft: helper.nft!.uid });
    await expectThrow(testEnv.wrap(withdrawNft)({}), WenError.you_must_be_the_owner_of_nft.key);

    mockWalletReturnValue(helper.walletSpy, helper.member!, { nft: helper.nft!.uid });
    const bidOrder = await testEnv.wrap(openBid)({});
    await requestFundsFromFaucet(Network.RMS, bidOrder.payload.targetAddress, MIN_IOTA_AMOUNT);

    await wait(async () => {
      helper.nft = <Nft>await nftDocRef.get();
      return !isEmpty(helper.nft.auctionHighestBidder);
    });

    const bidOrder2 = await testEnv.wrap(openBid)({});
    await requestFundsFromFaucet(Network.RMS, bidOrder2.payload.targetAddress, 2 * MIN_IOTA_AMOUNT);

    await wait(async () => {
      helper.nft = <Nft>await nftDocRef.get();

      const payment = (
        await build5Db()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.PAYMENT)
          .where('payload.sourceTransaction', 'array-contains', bidOrder2.uid)
          .get<Transaction>()
      )[0];
      return helper.nft.auctionHighestBidder === payment?.member;
    });

    await build5Db()
      .doc(`${COL.AUCTION}/${helper.nft!.auction}`)
      .update({ auctionTo: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });

    await finalizeAuctions();

    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.owner === helper.member;
    });

    mockWalletReturnValue(helper.walletSpy, helper.member!, { nft: helper.nft!.uid });
    await testEnv.wrap(withdrawNft)({});

    helper.nft = <Nft>await nftDocRef.get();
    expect(helper.nft.status).toBe(NftStatus.WITHDRAWN);

    await wait(async () => {
      const transaction = (
        await build5Db()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.WITHDRAW_NFT)
          .where('payload.nft', '==', helper.nft!.uid)
          .get<Transaction>()
      )[0];
      return transaction?.payload?.walletReference?.confirmed;
    });

    const output = (
      await helper.walletService!.client.getOutput(
        await helper.walletService!.client.nftOutputId(helper.nft.mintingData?.nftId!),
      )
    ).output as NftOutput;
    const ownerAddress = Bech32AddressHelper.bech32FromUnlockConditions(output, 'rms');
    const member = <Member>await build5Db().doc(`${COL.MEMBER}/${helper.member}`).get();
    expect(ownerAddress).toBe(getAddress(member, Network.ATOI));
  });
});
