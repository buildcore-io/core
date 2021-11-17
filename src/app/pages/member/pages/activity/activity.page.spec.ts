import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ActivityPage } from './activity.page';

describe('ActivityPage', () => {
  let spectator: Spectator<ActivityPage>;
  const createComponent = createRoutingFactory({
    component: ActivityPage,
    imports: [ NgApexchartsModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
