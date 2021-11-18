import { TabsComponent } from '@components/ui/components/tabs/tabs.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent } from 'ng-mocks';
import { DiscoverPage } from './discover.page';

describe('DiscoverPage', () => {
  let spectator: Spectator<DiscoverPage>;
  const createComponent = createRoutingFactory({
    component: DiscoverPage,
    declarations: [MockComponent(TabsComponent)]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
