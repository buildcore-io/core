import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { OverviewPage } from './../../../proposal/pages/overview/overview.page';

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
