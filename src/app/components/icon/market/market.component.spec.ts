import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { MarketIconComponent } from './market.component';


describe('MarketIconComponent', () => {
  let spectator: Spectator<MarketIconComponent>;
  const createComponent = createComponentFactory({
    component: MarketIconComponent
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
