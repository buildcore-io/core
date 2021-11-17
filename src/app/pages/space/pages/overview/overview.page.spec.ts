import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { OverviewPage } from './../../../proposal/pages/overview/overview.page';
import { DataService } from './../../../proposal/services/data.service';

describe('OverviewPage', () => {
  let spectator: Spectator<OverviewPage>;
  const createComponent = createRoutingFactory({
    component: OverviewPage,
    providers: [ DataService ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
