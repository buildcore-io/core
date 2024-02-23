import { Dataset } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';

async function main() {
    var members = await https(Build5.TEST)
        .project(SoonaverseApiKey[Build5.TEST])
        .dataset(Dataset.MEMBER)
        .getByField('name', 'Santa Claus');
    console.log(members);
}
main().then(() => process.exit());