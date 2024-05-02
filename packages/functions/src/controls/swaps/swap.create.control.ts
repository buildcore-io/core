import { database } from '@buildcore/database';
import { COL, Member, Network, SwapCreateRequest, Transaction } from '@buildcore/interfaces';
import { createSwapOrder } from '../../services/payment/swap/swap-service';
import { WalletService } from '../../services/wallet/wallet.service';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { Context } from '../common';

export const swapCreateControl = async ({
  owner,
  params,
  project,
}: Context<SwapCreateRequest>): Promise<Transaction> => {
  const network = params.network as Network;
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const ownerDocRef = database().doc(COL.MEMBER, owner);
  const ownerData = <Member>await ownerDocRef.get();

  assertMemberHasValidAddress(ownerData, params.network as Network);

  const { order, swap } = await createSwapOrder(
    wallet,
    project,
    owner,
    params.network as Network,
    targetAddress.bech32,
    params,
  );

  const batch = database().batch();
  const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
  batch.create(orderDocRef, order);
  const swapDocRef = database().doc(COL.SWAP, swap.uid);
  batch.create(swapDocRef, swap);
  await batch.commit();

  return <Transaction>await orderDocRef.get();
};
