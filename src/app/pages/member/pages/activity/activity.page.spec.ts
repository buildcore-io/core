import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { ActivityPage } from './activity.page';

describe('ActivityPage', () => {
  let spectator: Spectator<ActivityPage>;
  const createComponent = createRoutingFactory({
    component: ActivityPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
