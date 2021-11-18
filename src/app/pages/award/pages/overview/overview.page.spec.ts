import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from "@pages/award/services/data.service";
import { OverviewPage } from './overview.page';

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
