import { Dataset, Member } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';

async function main() {
  const origin = Build5.TEST;
  try {
    var members: Member[];
    const name = 'Santa Claus';
    members = await https(origin)
      .project(SoonaverseApiKey[Build5.TEST])
      .dataset(Dataset.MEMBER)
      .getByField('name', name);
    console.log('Members with name', name, ':', members.length);

    const space_id = '0x6355fbcc70c6498d0e86d729956686935746980a';
    members = await https(origin)
      .project(SoonaverseApiKey[Build5.TEST])
      .dataset(Dataset.MEMBER)
      .getBySpace(space_id);
    console.log('Members in space ', space_id, ':', members.length);

    const updatedAfter = 1705276800;
    members = await https(origin)
      .project(SoonaverseApiKey[Build5.TEST])
      .dataset(Dataset.MEMBER)
      .getAllUpdatedAfter(updatedAfter);
    console.log('Members updated after ', new Date(updatedAfter * 1000), ':', members.length);

    // Let's get some member ids
    const member_ids = members.map((member) => member.uid).slice(members.length - 2);
    members = await https(origin)
      .project(SoonaverseApiKey[Build5.TEST])
      .dataset(Dataset.MEMBER)
      .getManyById(member_ids);
    console.log('Members by id: ', members.length);

    members = await https(origin)
      .project(SoonaverseApiKey[Build5.TEST])
      .dataset(Dataset.MEMBER)
      .getTop(3);
    console.log('Top 3 member ids: ', members.map((member) => member.uid));
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
