import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { AwardPage } from './award.page';


describe('AwardPage', () => {
  let spectator: Spectator<AwardPage>;
  const createComponent = createRoutingFactory({
    component: AwardPage
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});

