import { TabsComponent } from '@components/tabs/tabs.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent } from 'ng-mocks';
import { MarketPage } from './market.page';

describe('MarketPage', () => {
  let spectator: Spectator<MarketPage>;
  const createComponent = createRoutingFactory({
    component: MarketPage,
    declarations: [MockComponent(TabsComponent)]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
