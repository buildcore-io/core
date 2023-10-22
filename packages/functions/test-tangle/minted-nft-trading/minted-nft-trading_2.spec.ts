import { build5Db } from '@build-5/database';
import {
  COL,
  Member,
  Network,
  Nft,
  NftStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import { NftOutput } from '@iota/sdk';
import dayjs from 'dayjs';
import { orderNft, withdrawNft } from '../../src/runtime/firebase/nft/index';
import { getAddress } from '../../src/utils/address.utils';
import { Bech32AddressHelper } from '../../src/utils/bech32-address.helper';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted nft trading', () => {
  const helper = new Helper();

  it.each([false, true])('Should order nft and withdraw it', async (hasExpiration: boolean) => {
    await helper.beforeEach(Network.RMS);
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
    await requestFundsFromFaucet(
      Network.RMS,
      order.payload.targetAddress,
      order.payload.amount,
      expiresAt,
    );

    await wait(async () => {
      const nft = <Nft>await build5Db().doc(`${COL.NFT}/${helper.nft!.uid}`).get();
      return nft.owner === helper.member;
    });

    mockWalletReturnValue(helper.walletSpy, helper.member!, { nft: helper.nft!.uid });
    await testEnv.wrap(withdrawNft)({});

    const nft = <Nft>await build5Db().doc(`${COL.NFT}/${helper.nft!.uid}`).get();
    expect(nft.status).toBe(NftStatus.WITHDRAWN);

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
        await helper.walletService!.client.nftOutputId(nft.mintingData?.nftId!),
      )
    ).output;
    const ownerAddress = Bech32AddressHelper.bech32FromUnlockConditions(output as NftOutput, 'rms');
    const member = <Member>await build5Db().doc(`${COL.MEMBER}/${helper.member}`).get();
    expect(ownerAddress).toBe(getAddress(member, Network.RMS));
  });
});
