import { TabsComponent } from '@components/tabs/tabs.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { FilterService } from '@pages/market/services/filter.service';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { MockComponent } from 'ng-mocks';
import { MarketPage } from './market.page';

describe('MarketPage', () => {
  let spectator: Spectator<MarketPage>;
  const createComponent = createRoutingFactory({
    component: MarketPage,
    imports: [LayoutModule],
    declarations: [MockComponent(TabsComponent)],
    providers: [FilterService]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
