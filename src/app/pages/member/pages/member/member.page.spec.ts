import { TabsComponent } from '@components/tabs/tabs.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent } from 'ng-mocks';
import { BadgeTileComponent } from '../../../../components/badge/badge-tile/badge-tile.component';
import { MemberEditDrawerComponent } from '../../../../components/member/components/member-edit-drawer/member-edit-drawer.component';
import { MemberTileComponent } from './../../../../components/member/components/tile/member-tile.component';
import { DataService } from './../../services/data.service';
import { MemberPage } from './member.page';

describe('MemberPage', () => {
  let spectator: Spectator<MemberPage>;
  const createComponent = createRoutingFactory({
    component: MemberPage,
    providers: [DataService],
    declarations: [
      MockComponent(MemberEditDrawerComponent),
      MockComponent(MemberTileComponent),
      MockComponent(BadgeTileComponent),
      MockComponent(TabsComponent)
    ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
