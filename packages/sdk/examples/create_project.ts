import { Network, ProjectCreateResponse } from '@build-5/interfaces';
import { Build5, https } from '@build-5/sdk';
import { address } from './utils/secret';
import { walletSign } from './utils/utils';

async function main() {
  const origin = Build5.TEST;
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
  } catch (e) {
    console.log(e);
    return;
  }

  console.log('Project created id: ', responseProject.project.uid, ', API Key: ', responseProject.token);
}

main().then(() => process.exit());
