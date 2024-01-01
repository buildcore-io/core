import { Build5, https } from '@build-5/sdk';
import { address } from '../utils/secret';

async function main() {
  const origin = Build5.TEST;
  try {
    const response = await https(origin).createMember({
      address: address.bech32,
      signature: '',
      body: {
        address: address.bech32,
      },
    });

    console.log('Member uid: ', response.uid);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
