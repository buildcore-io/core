/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, MIN_IOTA_AMOUNT, Network, Transaction, TransactionType } from '@build5/interfaces';
import { ITransactionPayload, TRANSACTION_ID_LENGTH } from '@iota/iota.js';
import {
  ITransactionPayload as NextITransactionPayload,
  TransactionHelper,
} from '@iota/iota.js-next';
import { Converter, WriteStream } from '@iota/util.js';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { retryWallet } from '../../src/cron/wallet.cron';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { IotaWallet } from '../../src/services/wallet/IotaWalletService';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { AddressDetails } from '../../src/services/wallet/wallet';
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
      const billPaymentDocRef = soonDb().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
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
      if (network === Network.ATOI) {
        const block = await (wallet as IotaWallet).client.message(
          billPayment.payload.walletReference.chainReference,
        );
        const inputs = (block.payload as ITransactionPayload).essence.inputs;
        consumedOutputIds = inputs.map((input) =>
          outputIdFromTransactionData(input.transactionId, input.transactionOutputIndex),
        );
      } else {
        const block = await (wallet as SmrWallet).client.block(
          billPayment.payload.walletReference.chainReference,
        );
        const inputs = (block.payload as NextITransactionPayload).essence.inputs;
        consumedOutputIds = inputs.map((input) =>
          TransactionHelper.outputIdFromTransactionData(
            input.transactionId,
            input.transactionOutputIndex,
          ),
        );
      }
      expect(outputIds.sort()).toEqual(consumedOutputIds.sort());
    },
  );
});

const dummyPayment = (
  type: TransactionType,
  network: Network,
  sourceAddress: string,
  targetAddress: string,
  amount = MIN_IOTA_AMOUNT,
) =>
  <Transaction>{
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
  if (network === Network.RMS) {
    const outputs = await (wallet as SmrWallet).getOutputs(address.bech32, [], false);
    return Object.keys(outputs);
  }
  const outputs = await (wallet as IotaWallet).getOutputs(address.hex);
  return Object.keys(outputs);
};

const outputIdFromTransactionData = (transactionId: string, outputIndex: number): string => {
  const writeStream = new WriteStream();
  writeStream.writeFixedHex('transactionId', TRANSACTION_ID_LENGTH, transactionId);
  writeStream.writeUInt16('outputIndex', outputIndex);
  const outputIdBytes = writeStream.finalBytes();

  return Converter.bytesToHex(outputIdBytes);
};
