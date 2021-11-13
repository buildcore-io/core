import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DiscoverPage } from './discover.page';

describe('DiscoverPage', () => {
  let spectator: Spectator<DiscoverPage>;
  const createComponent = createRoutingFactory({
    component: DiscoverPage,
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
