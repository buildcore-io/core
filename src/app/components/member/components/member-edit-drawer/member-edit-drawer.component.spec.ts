import { IconModule } from '@components/icon/icon.module';
import { IpfsAvatarModule } from "@core/pipes/ipfs-avatar/ipfs-avatar.module";
import { IpfsBadgeModule } from "@core/pipes/ipfs-badge/ipfs-badge.module";
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { MemberEditDrawerComponent } from './member-edit-drawer.component';


describe('MemberEditDrawerComponent', () => {
  let spectator: Spectator<MemberEditDrawerComponent>;
  const createComponent = createComponentFactory({
    component: MemberEditDrawerComponent,
    imports: [IconModule, IpfsBadgeModule, IpfsAvatarModule]
  });
  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
