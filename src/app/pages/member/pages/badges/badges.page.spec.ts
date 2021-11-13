import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { BadgesPage } from './badges.page';

describe('BadgesPage', () => {
  let spectator: Spectator<BadgesPage>;
  const createComponent = createRoutingFactory({
    component: BadgesPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
