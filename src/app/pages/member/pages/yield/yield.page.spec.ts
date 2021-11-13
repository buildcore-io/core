import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { YieldPage } from './yield.page';


describe('YieldPage', () => {
  let spectator: Spectator<YieldPage>;
  const createComponent = createRoutingFactory({
    component: YieldPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
