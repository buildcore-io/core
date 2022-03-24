import { SelectSpaceModule } from '@components/space/components/select-space/select-space.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from "@pages/member/services/data.service";
import { ActivityPage } from './activity.page';

describe('ActivityPage', () => {
  let spectator: Spectator<ActivityPage>;
  const createComponent = createRoutingFactory({
    component: ActivityPage,
    providers: [ DataService ],
    imports: [ SelectSpaceModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
