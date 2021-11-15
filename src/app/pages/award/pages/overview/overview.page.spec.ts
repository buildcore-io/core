import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { OverviewPage } from './overview.page';

describe('OverviewPage', () => {
  let spectator: Spectator<OverviewPage>;
  const createComponent = createRoutingFactory({
    component: OverviewPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
