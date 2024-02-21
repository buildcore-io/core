import { Dataset } from '@build-5/interfaces';
import { Build5, SoonaverseOtrAddress, otr } from '@build-5/sdk';

async function main() {
  const origin = Build5.TEST;
  // @ts-ignore
  const otrAddress = SoonaverseOtrAddress[origin];

  console.log('Create swap. Set network, recipient and asks.');
  console.log('Asks can be base token, native tokens and nfts');
  console.log(
    'If setFunded is set to true, the swap will be created' +
      " and the bid side is already set with the reques's assets",
  );

  console.log(
    'If setFunded is set to false, swap will be created empty ' +
      ' and funds will be returned to the sender address with swap id and address',
  );
  try {
    const otrRequest = otr(otrAddress)
      .dataset(Dataset.SWAP)
      .create({
        recipient: 'recipient UID or address',
        nfts: ['nftUid1', 'nftUid2'],
        setFunded: true,
      });

    const fireflyDeeplink = otrRequest.getFireflyDeepLink();
    console.log(fireflyDeeplink);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
