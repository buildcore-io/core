import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { SpacePage } from './space.page';

describe('SpacePage', () => {
  let spectator: Spectator<SpacePage>;
  const createComponent = createRoutingFactory({
    component: SpacePage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
