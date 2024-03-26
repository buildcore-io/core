import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  Nft,
  NftStatus,
  Transaction,
  TransactionType,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import { NftOutput } from '@iota/sdk';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { finalizeAuctions } from '../../src/cron/auction.cron';
import { getAddress } from '../../src/utils/address.utils';
import { Bech32AddressHelper } from '../../src/utils/bech32-address.helper';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { expectThrow, wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted nft trading', () => {
  const helper = new Helper();

  it('Should bid twice on minted nft and withdraw it', async () => {
    await helper.beforeEach(Network.RMS);
    await helper.createAndOrderNft();
    await helper.mintCollection();

    await helper.setAvailableForAuction();

    const nftDocRef = build5Db().doc(COL.NFT, helper.nft!.uid);

    mockWalletReturnValue(helper.member!, { nft: helper.nft!.uid });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.withdrawNft),
      WenError.you_must_be_the_owner_of_nft.key,
    );

    const expiresAt = dateToTimestamp(dayjs().add(2, 'h').toDate());

    mockWalletReturnValue(helper.member!, { nft: helper.nft!.uid });
    const bidOrder = await testEnv.wrap<Transaction>(WEN_FUNC.openBid);
    await requestFundsFromFaucet(
      Network.RMS,
      bidOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      expiresAt,
    );

    await wait(async () => {
      helper.nft = <Nft>await nftDocRef.get();
      return !isEmpty(helper.nft.auctionHighestBidder);
    });

    const bidOrder2 = await testEnv.wrap<Transaction>(WEN_FUNC.openBid);
    await requestFundsFromFaucet(
      Network.RMS,
      bidOrder2.payload.targetAddress,
      2 * MIN_IOTA_AMOUNT,
      expiresAt,
    );

    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();

      const payment = (
        await build5Db()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.PAYMENT)
          .where('payload_sourceTransaction', 'array-contains', bidOrder2.uid as any)
          .get()
      )[0];
      return nft.auctionHighestBidder === payment?.member;
    });

    await build5Db()
      .doc(COL.AUCTION, helper.nft!.auction!)
      .update({ auctionTo: dayjs().subtract(1, 'm').toDate() });

    await finalizeAuctions();

    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.owner === helper.member;
    });

    mockWalletReturnValue(helper.member!, { nft: helper.nft!.uid });
    await testEnv.wrap(WEN_FUNC.withdrawNft);

    helper.nft = <Nft>await nftDocRef.get();
    expect(helper.nft.status).toBe(NftStatus.WITHDRAWN);

    await wait(async () => {
      const transaction = (
        await build5Db()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.WITHDRAW_NFT)
          .where('payload_nft', '==', helper.nft!.uid)
          .get()
      )[0];
      return transaction?.payload?.walletReference?.confirmed;
    });

    const output = (
      await helper.walletService!.client.getOutput(
        await helper.walletService!.client.nftOutputId(helper.nft.mintingData?.nftId!),
      )
    ).output;
    const ownerAddress = Bech32AddressHelper.bech32FromUnlockConditions(output as NftOutput, 'rms');
    const member = <Member>await build5Db().doc(COL.MEMBER, helper.member).get();
    expect(ownerAddress).toBe(getAddress(member, Network.RMS));
  });
});
