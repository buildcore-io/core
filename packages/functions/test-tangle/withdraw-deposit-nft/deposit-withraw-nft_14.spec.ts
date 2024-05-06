/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  COL,
  IgnoreWalletReason,
  Member,
  Network,
  Nft,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { wait } from '../../test/controls/common';
import { getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';
describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should withdraw minted nft and deposit it back', async () => {
    let nft = await helper.createAndOrderNft();
    await helper.mintCollection();
    const tmpAddress = await helper.walletService!.getNewIotaAddressDetails();
    await helper.updateGuardianAddress(tmpAddress.bech32);

    const nftDocRef = database().doc(COL.NFT, nft.uid);
    mockWalletReturnValue(helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(WEN_FUNC.withdrawNft);
    const query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload_nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>await nftDocRef.get();
    let snap = await query.get();
    expect(snap[0].payload.nftId).toBe(nft.mintingData?.nftId);

    const wallet = await getWallet(helper.network);
    const guardianDocRef = database().doc(COL.MEMBER, helper.guardian!);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianAddress = getAddress(guardianData, helper.network!);
    const nftWallet = new NftWallet(wallet);
    const outputs = await nftWallet.getNftOutputs(undefined, guardianAddress);
    expect(Object.keys(outputs).length).toBe(1);

    mockWalletReturnValue(helper.guardian!, { network: helper.network });
    let depositOrder = await testEnv.wrap<Transaction>(WEN_FUNC.depositNft);

    const sourceAddress = await helper.walletService!.getAddressDetails(guardianAddress);
    await helper.sendNftToAddress(
      sourceAddress!,
      depositOrder.payload.targetAddress!,
      dateToTimestamp(dayjs().add(1, 'd')),
      undefined,
      guardianAddress,
    );

    const creditQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian)
      .where('type', '==', TransactionType.CREDIT_NFT);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1;
    });

    snap = await creditQuery.get();
    const credit = snap[0] as Transaction;
    expect(credit.ignoreWallet).toBe(true);
    expect(credit.ignoreWalletReason).toBe(
      IgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION,
    );

    mockWalletReturnValue(helper.guardian!, { transaction: credit.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.creditUnrefundable);
    await requestFundsFromFaucet(Network.RMS, order.payload.targetAddress, order.payload.amount);

    await wait(async () => {
      const snap = await creditQuery.get();
      return snap[0]?.payload?.walletReference?.confirmed;
    });
  });
});
