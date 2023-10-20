/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, MIN_IOTA_AMOUNT, Network, Transaction, TransactionType } from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { packBasicOutput } from '../../src/utils/basic-output.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

describe('Transaction trigger spec', () => {
  let sourceAddress: AddressDetails;
  let targetAddress: AddressDetails;
  let storageDepositSourceAddress: AddressDetails;

  const setup = async (network: Network, amount = MIN_IOTA_AMOUNT, storageDep = 0) => {
    const wallet = await getWallet(network);
    sourceAddress = await wallet.getNewIotaAddressDetails();
    targetAddress = await wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(network, sourceAddress.bech32, amount);
    if (storageDep) {
      storageDepositSourceAddress = await wallet.getNewIotaAddressDetails();
      await requestFundsFromFaucet(network, storageDepositSourceAddress.bech32, amount);
    }
  };

  it('Should send native tokens and credit it', async () => {
    const network = Network.RMS;
    await setup(network);
    const wallet = await getWallet(network);
    const vaultAddress = await wallet.getIotaAddressDetails(VAULT_MNEMONIC);
    await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic);

    const output = await packBasicOutput(wallet, targetAddress.bech32, 0, {
      nativeTokens: [{ amount: BigInt(1), id: MINTED_TOKEN_ID }],
    });
    await requestFundsFromFaucet(network, sourceAddress.bech32, Number(output.amount));

    let billPayment: Transaction = {
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      network,
      payload: {
        amount: Number(output.amount),
        nativeTokens: [{ amount: BigInt(1), id: MINTED_TOKEN_ID }],
        storageDepositSourceAddress: sourceAddress.bech32,
        sourceAddress: vaultAddress.bech32,
        targetAddress: targetAddress.bech32,
        void: false,
      },
    };
    await build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment);
    await wait(async () => {
      const { nativeTokens } = await wallet.getBalance(targetAddress.bech32);
      return Number(Object.values(nativeTokens)[0]) === 1;
    });

    let credit: Transaction = {
      type: TransactionType.CREDIT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      network,
      payload: {
        amount: Number(output.amount),
        nativeTokens: [{ amount: BigInt(1), id: MINTED_TOKEN_ID }],
        sourceAddress: targetAddress.bech32,
        targetAddress: sourceAddress.bech32,
        void: false,
      },
    };
    await build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`).create(credit);
    await wait(async () => {
      const { nativeTokens } = await wallet.getBalance(sourceAddress.bech32);
      return Number(Object.values(nativeTokens)[0]) === 1;
    });

    await wait(async () => {
      billPayment = <Transaction>(
        await build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get()
      );
      credit = <Transaction>await build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`).get();
      return (
        billPayment.payload?.walletReference?.confirmed &&
        credit.payload?.walletReference?.confirmed
      );
    });
  });
});

export const VAULT_MNEMONIC =
  'find adapt flag dentist chicken soldier push all odor vacuum jacket twelve voyage senior into mother fix expose dice risk soup cradle sound isolate';
export const MINTED_TOKEN_ID =
  '0x08e3afe829d6cb7ca885d1ad95428e200541f8bb21cecc42054f122d56cd606a370100000000';
