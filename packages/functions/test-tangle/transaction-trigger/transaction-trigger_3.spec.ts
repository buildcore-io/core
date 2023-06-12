/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, MIN_IOTA_AMOUNT, Network, Transaction, TransactionType } from '@build5/interfaces';
import { addressBalance } from '@iota/iota.js-next';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { AddressDetails } from '../../src/services/wallet/wallet';
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

  it('Should send native tokens', async () => {
    const network = Network.RMS;
    await setup(network);
    const wallet = (await getWallet(network)) as SmrWallet;
    const vaultAddress = await wallet.getIotaAddressDetails(VAULT_MNEMONIC);
    await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic);

    const output = packBasicOutput(
      targetAddress.bech32,
      0,
      [{ amount: '0x1', id: MINTED_TOKEN_ID }],
      wallet.info,
    );
    await requestFundsFromFaucet(network, sourceAddress.bech32, Number(output.amount));

    let billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      network,
      payload: {
        amount: Number(output.amount),
        nativeTokens: [{ amount: 1, id: MINTED_TOKEN_ID }],
        storageDepositSourceAddress: sourceAddress.bech32,
        sourceAddress: vaultAddress.bech32,
        targetAddress: targetAddress.bech32,
        void: false,
      },
    };
    await soonDb().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment);

    await wait(async () => {
      const balance = await addressBalance(wallet.client, targetAddress.bech32);
      return Number(Object.values(balance.nativeTokens)[0]) === 1;
    });
    await wait(async () => {
      const balance = await addressBalance(wallet.client, sourceAddress.bech32);
      return Number(balance.balance) === MIN_IOTA_AMOUNT;
    });

    await wait(async () => {
      billPayment = <Transaction>await soonDb().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get();
      return billPayment.payload?.walletReference?.confirmed;
    });
  });
});

const VAULT_MNEMONIC =
  'crouch violin broom degree diet primary juice vacuum crouch invite cotton endorse zebra mosquito dawn evil motion turkey apple secret indicate miracle lady husband';
const MINTED_TOKEN_ID =
  '0x08a7d756feb7427a5e31b152fb425ede7ee938a8af0b0e2730ea809c8435022ecd0100000000';
