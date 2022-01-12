import { DropdownTabsModule } from '@components/dropdown-tabs/dropdown-tabs.module';
import { TabsComponent } from '@components/tabs/tabs.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { MockComponent } from 'ng-mocks';
import { FilterService } from './../../services/filter.service';
import { DiscoverPage } from './discover.page';

describe('DiscoverPage', () => {
  let spectator: Spectator<DiscoverPage>;
  const createComponent = createRoutingFactory({
    component: DiscoverPage,
    providers: [ FilterService ],
    imports: [ LayoutModule, DropdownTabsModule ],
    declarations: [MockComponent(TabsComponent)]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
