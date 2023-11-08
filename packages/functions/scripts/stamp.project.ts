import { MIN_IOTA_AMOUNT, Network, TangleRequestType } from '@build-5/interfaces';
import {
  ReferenceUnlock,
  RegularTransactionEssence,
  TaggedDataPayload,
  TransactionPayload,
  UTXOInput,
  Utils,
  hexToUtf8,
} from '@iota/sdk';
import archiver from 'archiver';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import ignore from 'ignore';
import path from 'path';
import { Wallet, WalletParams } from '../src/services/wallet/wallet';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet.service';
import { packBasicOutput } from '../src/utils/basic-output.utils';
import { createUnlock, packEssence, submitBlock } from '../src/utils/block.utils';
import { getBucket } from '../src/utils/config.utils';
import serviceAccount from './serviceAccountKey.json';

dotenv.config({ path: __dirname + '/.env' });

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any),
});
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: serviceAccount.project_id });

const outputFile = './build5.zip';
fs.rmSync(outputFile, { force: true });

const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', { zlib: { level: 9 } });

const addToArchive = (dir: string) => {
  const ig = ignore().add(fs.readFileSync('.gitignore').toString());
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (ig.ignores(fullPath) || fullPath.includes('.git') || fullPath.includes('build5.zip')) {
      return;
    }
    if (fs.statSync(fullPath).isDirectory()) {
      addToArchive(fullPath);
    } else {
      archive.file(fullPath, { name: fullPath });
    }
  });
};

const zipProject = () =>
  new Promise<void>((res) => {
    archive.pipe(output);
    addToArchive('.');
    archive.finalize();
    output.on('close', function () {
      const mb = archive.pointer() / 1024 / 1024;
      console.log(`Zip file created: ${outputFile} (${mb} total mb)`);
      fs.chmodSync(outputFile, 777);
      res();
    });
  });

const stampProject = async () => {
  await zipProject();
  const storage = getStorage(app);
  const bucket = storage.bucket(getBucket());
  const asd = await bucket.upload('./build5.zip', { destination: 'build5.zip' });
  const uri = asd[1].mediaLink;

  const otrAddress = process.env.OTR_ADDRESS!;

  const network = otrAddress?.slice(0, 3) as Network;
  const wallet = await WalletService.newWallet(network);
  const stampAddress = await wallet.getIotaAddressDetails(process.env.STAMP_MNEMONIC!);
  const request = { requestType: TangleRequestType.STAMP, uri };

  const block = await send(wallet, stampAddress, otrAddress, MIN_IOTA_AMOUNT, {
    customMetadata: { request },
  });
  const response = await getResponseBlockMetadata(block, wallet);
  console.log(response);

  const oneDayCost = response.amountToMint + response.dailyCost;
  await send(wallet, stampAddress, response.address, oneDayCost, {});

  await wallet.client.destroy();
  process.exit();
};

const send = async (
  wallet: Wallet,
  from: AddressDetails,
  to: string,
  amount: number,
  params: WalletParams,
) => {
  const consumedOutputIds = (await wallet.client.basicOutputIds([{ address: from.bech32 }])).items;
  const consumedOutputs = (await wallet.client.getOutputs(consumedOutputIds)).map((o) => o.output);

  const output = await packBasicOutput(wallet, to, amount, params);

  const remainderAmount =
    consumedOutputs.reduce((acc, act) => acc + Number(act.amount), 0) - amount;
  const remainder = await packBasicOutput(wallet, from.bech32, remainderAmount, {});

  const inputs = consumedOutputIds.map(UTXOInput.fromOutputId);
  const inputsCommitment = Utils.computeInputsCommitment(consumedOutputs);

  const essence = await packEssence(wallet, inputs, inputsCommitment, [output, remainder], {});
  const fromUnlock = await createUnlock(essence, from);
  const unlocks = consumedOutputs.map((_, i) => (i ? new ReferenceUnlock(0) : fromUnlock));
  return submitBlock(wallet, essence, unlocks);
};

const getResponseBlockMetadata = async (blockId: string, wallet: Wallet) => {
  console.log('Awaiting response, this might take a minute or two...');
  const block = await wallet.client.getBlock(blockId);
  const outputId = Utils.computeOutputId(
    Utils.transactionId(block.payload as TransactionPayload),
    0,
  );

  await wait(async () => {
    try {
      const output = await wallet.client.getOutput(outputId);
      return output.metadata.isSpent;
    } catch {
      return false;
    }
  });

  const output = await wallet.client.getOutput(outputId);
  const transactionId = output.metadata.transactionIdSpent!;
  const spentBlock = await wallet.client.getIncludedBlock(transactionId);
  const payload = <TransactionPayload>spentBlock.payload;
  const essence = payload.essence as RegularTransactionEssence;
  const hexData = (essence?.payload as TaggedDataPayload)?.data || '';
  const metadata = JSON.parse(hexToUtf8(hexData));
  return metadata.response;
};

const wait = async (func: () => Promise<boolean | undefined>, maxAttempt = 1200, delay = 500) => {
  for (let attempt = 0; attempt < maxAttempt; ++attempt) {
    if (await func()) {
      return;
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error('Timeout');
};

stampProject();
