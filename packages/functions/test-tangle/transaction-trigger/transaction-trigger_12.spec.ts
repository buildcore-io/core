/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  NetworkAddress,
  SOON_PROJECT_ID,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { RegularTransactionEssence, TransactionPayload, UTXOInput, Utils } from '@iota/sdk';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { retryWallet } from '../../src/cron/wallet.cron';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
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

  it.each([Network.ATOI, Network.RMS])(
    'Should retry with same output ids',
    async (network: Network) => {
      await setup(network);
      const wallet = await getWallet(network);
      const outputIds = await getOutputs(network, sourceAddress);
      let billPayment = <Transaction>{
        ...dummyPayment(
          TransactionType.BILL_PAYMENT,
          network,
          sourceAddress.bech32,
          targetAddress.bech32,
          2 * MIN_IOTA_AMOUNT,
        ),
      };
      const billPaymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
      await billPaymentDocRef.create(billPayment);

      await wait(async () => {
        billPayment = <Transaction>await billPaymentDocRef.get();
        return !isEmpty(billPayment.payload?.walletReference?.chainReferences);
      });

      let consumedOutputIds =
        (await MnemonicService.getData(sourceAddress.bech32)).consumedOutputIds || [];
      expect(consumedOutputIds.sort()).toEqual(outputIds.sort());

      await billPaymentDocRef.update({
        'payload.amount': MIN_IOTA_AMOUNT,
        'payload.walletReference.processedOn': dateToTimestamp(
          dayjs().subtract(4, 'minute').toDate(),
        ),
      });
      const result = await retryWallet();
      expect(result.find((r) => r === billPayment.uid)).toBeDefined();

      await wait(async () => {
        billPayment = <Transaction>await billPaymentDocRef.get();
        return billPayment.payload?.walletReference?.confirmed;
      });

      consumedOutputIds = [];

      const block = await wallet.client.getBlock(
        billPayment.payload.walletReference!.chainReference!,
      );
      const payload = block.payload as TransactionPayload;
      const inputs = (payload.essence as RegularTransactionEssence).inputs;
      consumedOutputIds = inputs.map((i) => {
        const { transactionId, transactionOutputIndex } = i as UTXOInput;
        return Utils.computeOutputId(transactionId, transactionOutputIndex);
      });
      expect(outputIds.sort()).toEqual(consumedOutputIds.sort());
    },
  );
});

const dummyPayment = (
  type: TransactionType,
  network: Network,
  sourceAddress: NetworkAddress,
  targetAddress: NetworkAddress,
  amount = MIN_IOTA_AMOUNT,
) =>
  <Transaction>{
    project: SOON_PROJECT_ID,
    type,
    uid: getRandomEthAddress(),
    createdOn: serverTime(),
    network,
    payload: {
      amount,
      sourceAddress,
      targetAddress,
      void: false,
      dependsOnBillPayment: type === TransactionType.CREDIT,
    },
  };

const getOutputs = async (network: Network, address: AddressDetails) => {
  const wallet = await getWallet(network);
  const outputs = await wallet.getOutputs(address.bech32, [], false);
  return Object.keys(outputs);
};
