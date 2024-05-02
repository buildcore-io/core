import { Network, ProjectCreateResponse } from '@buildcore/interfaces';
import { Buildcore, https } from '@buildcore/sdk';
import { address } from './utils/secret';
import { walletSign } from './utils/utils';

async function main() {
  const origin = Buildcore.TEST;
  let responseProject: ProjectCreateResponse;
  let userSign = await walletSign(address.bech32, address);
  try {
    responseProject = await https(origin).createProject({
      address: address.bech32,
      signature: userSign.signature,
      publicKey: {
        hex: userSign.publicKey,
        network: Network.RMS,
      },
      body: {
        name: 'TanKRURK',
        config: {
          billing: 'volume_based',
        },
      },
    });

    console.log(
      'Project created id: ',
      responseProject.project.uid,
      ', API Key: ',
      responseProject.token,
    );
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
