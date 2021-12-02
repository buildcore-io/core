import { IconModule } from '@components/icon/icon.module';
import { IpfsAvatarModule } from "@core/pipes/ipfs-avatar/ipfs-avatar.module";
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { IpfsBadgeModule } from './../../../../@core/pipes/ipfs-badge/ipfs-badge.module';
import { MemberCardComponent } from './member-card.component';


describe('MemberCardComponent', () => {
  let spectator: Spectator<MemberCardComponent>;
  const createComponent = createRoutingFactory({
    component: MemberCardComponent,
    imports: [IconModule, IpfsBadgeModule, IpfsAvatarModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
