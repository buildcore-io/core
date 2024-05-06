import { Bip32Path } from '@iota/crypto.js';
import {
  Bech32Helper,
  ED25519_ADDRESS_TYPE,
  Ed25519Address,
  Ed25519Seed,
  IKeyPair,
  ISigLockedSingleOutput,
  IUTXOInput,
  SIG_LOCKED_SINGLE_OUTPUT_TYPE,
  SingleNodeClient,
  UTXO_INPUT_TYPE,
  sendAdvanced,
} from '@iota/iota.js';
import { Converter } from '@iota/util.js';
import { generateMnemonic } from 'bip39';
import { getRandomEthAddress } from '../src/utils/wallet.utils';

// MAINNET
// const API_ENDPOINT = "https://chrysalis-nodes.iota.org";
// DEVNET
const API_ENDPOINT = 'https://api.lb-0.h.chrysalis-devnet.iota.cafe/';

async function run() {
  const client = new SingleNodeClient(API_ENDPOINT);
  const nodeInfo = await client.info();

  // These are the default values from the Hornet alphanet configuration
  // const mnemonic = "giant dynamic museum toddler six deny defense ostrich bomb access mercy blood explain muscle shoot shallow glad autumn author calm heavy hawk apple rally";
  const mnemonic =
    'bitter icon bridge age uncle drop radar cook wrap soda purse claim scrub toast day shop marble rural target island asset ethics seven picture'; // "giant dynamic museum toddler six deny defense ostrich bomb access mercy blood explain muscle shoot shallow glad autumn apple calm heavy hawk apple rally"; // atoi1qpg4tqh7vj9s7y9zk2smj8t4qgvse9um42l7apdkhw6syp5ju4w3vet6gtj

  console.log(generateMnemonic() + ' ' + generateMnemonic());

  // Generate the seed from the Mnemonic
  const genesisSeed = Ed25519Seed.fromMnemonic(mnemonic);
  console.log('Genesis');

  const genesisPath = new Bip32Path("m/44'/4218'/0'/0'/0'");
  const genesisWalletSeed = genesisSeed.generateSeedFromPath(genesisPath);
  const genesisWalletKeyPair = genesisWalletSeed.keyPair();
  console.log('\tSeed', Converter.bytesToHex(genesisWalletSeed.toBytes()));

  // Get the address for the path seed which is actually the Blake2b.sum256 of the public key
  // display it in both Ed25519 and Bech 32 format
  const genesisEd25519Address = new Ed25519Address(genesisWalletKeyPair.publicKey);
  const genesisWalletAddress = genesisEd25519Address.toAddress();
  const genesisWalletAddressHex = Converter.bytesToHex(genesisWalletAddress);
  console.log('\tAddress Ed25519', genesisWalletAddressHex);
  console.log(
    '\tAddress Bech32',
    Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, genesisWalletAddress, nodeInfo.bech32HRP),
  );

  // Get HEX from target address.
  const decodeBench32Target = Bech32Helper.fromBech32(
    'atoi1qpg4tqh7vj9s7y9zk2smj8t4qgvse9um42l7apdkhw6syp5ju4w3vet6gtj',
    nodeInfo.bech32HRP,
  );
  const newAddressHex = Converter.bytesToHex(decodeBench32Target!.addressBytes);
  // console.log(newAddressHex);

  // Because we are using the genesis address we must use send advanced as the input address is
  // not calculated from a Bip32 path, if you were doing a wallet to wallet transfer you can just use send
  // which calculates all the inputs/outputs for you
  const genesisAddressOutputs = await client.addressEd25519Outputs(genesisWalletAddressHex);
  const inputsWithKeyPairs: {
    input: IUTXOInput;
    addressKeyPair: IKeyPair;
  }[] = [];

  let totalGenesis = 0;

  for (let i = 0; i < genesisAddressOutputs.outputIds.length; i++) {
    const output = await client.output(genesisAddressOutputs.outputIds[i]);
    if (!output.isSpent) {
      inputsWithKeyPairs.push({
        input: {
          type: UTXO_INPUT_TYPE,
          transactionId: output.transactionId,
          transactionOutputIndex: output.outputIndex,
        },
        addressKeyPair: genesisWalletKeyPair,
      });
      if (output.output.type === SIG_LOCKED_SINGLE_OUTPUT_TYPE) {
        totalGenesis += (output.output as ISigLockedSingleOutput).amount;
      }
    }
  }

  const amountToSend = 90000000;

  const outputs: {
    address: string;
    addressType: number;
    amount: number;
  }[] = [
    // This is the transfer to the new address
    {
      address: newAddressHex,
      addressType: ED25519_ADDRESS_TYPE,
      amount: amountToSend,
    },
  ];

  const reminder: number = totalGenesis - amountToSend;
  if (reminder > 0) {
    outputs.push({
      address: genesisWalletAddressHex,
      addressType: ED25519_ADDRESS_TYPE,
      amount: reminder,
    });
  }

  const { messageId } = await sendAdvanced(client, inputsWithKeyPairs, outputs, {
    key: Converter.utf8ToBytes('Soonaverse'),
    data: Converter.utf8ToBytes(
      JSON.stringify({
        url: 'www.soonaverse.com/nft/12',
        eth: getRandomEthAddress(),
      }),
    ),
  });

  console.log('Created Message Id', messageId);
}

run()
  .then(() => console.log('Done'))
  .catch((err) => console.error(err));
