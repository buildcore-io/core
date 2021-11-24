import { TabsComponent } from '@components/tabs/tabs.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent } from 'ng-mocks';
import { FilterService } from './../../services/filter.service';
import { DiscoverPage } from './discover.page';

describe('DiscoverPage', () => {
  let spectator: Spectator<DiscoverPage>;
  const createComponent = createRoutingFactory({
    component: DiscoverPage,
    providers: [ FilterService ],
    declarations: [MockComponent(TabsComponent)]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
