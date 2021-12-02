import { IconModule } from '@components/icon/icon.module';
import { IpfsAvatarModule } from "@core/pipes/ipfs-avatar/ipfs-avatar.module";
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { NewPage } from './new.page';

describe('NewPage', () => {
  let spectator: Spectator<NewPage>;
  const createComponent = createRoutingFactory({
    component: NewPage,
    imports: [IconModule, IpfsAvatarModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
