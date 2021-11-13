import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent } from 'ng-mocks';
import { BadgeTileComponent } from './../../../../components/ui/components/badge/badge-tile/badge-tile.component';
import { MemberEditDrawerComponent } from './../../../../components/ui/components/member/member-edit-drawer/member-edit-drawer.component';
import { MemberTileComponent } from './../../../../components/ui/components/member/tile/member-tile.component';
import { MemberPage } from './member.page';

describe('MemberPage', () => {
  let spectator: Spectator<MemberPage>;
  const createComponent = createRoutingFactory({
    component: MemberPage,
    declarations: [
      MockComponent(MemberEditDrawerComponent),
      MockComponent(MemberTileComponent),
      MockComponent(BadgeTileComponent)
    ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
