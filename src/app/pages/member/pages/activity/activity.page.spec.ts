import { SelectSpaceModule } from '@components/space/components/select-space/select-space.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from "@pages/member/services/data.service";
import { NgApexchartsModule } from 'ng-apexcharts';
import { ActivityPage } from './activity.page';

describe('ActivityPage', () => {
  let spectator: Spectator<ActivityPage>;
  const createComponent = createRoutingFactory({
    component: ActivityPage,
    providers: [ DataService ],
    imports: [ NgApexchartsModule, SelectSpaceModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
