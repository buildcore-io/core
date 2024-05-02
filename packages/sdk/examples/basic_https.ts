import { Dataset } from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, https } from '@buildcore/sdk';

async function main() {
  var members = await https(Buildcore.TEST)
    .project(SoonaverseApiKey[Buildcore.TEST])
    .dataset(Dataset.MEMBER)
    .getByField('name', 'Santa Claus');
  console.log(members);
}
main().then(() => process.exit());
