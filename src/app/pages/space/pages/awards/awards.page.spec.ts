import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from "@pages/space/services/data.service";
import { AwardsCardModule } from './../../../../components/awards/components/award-card/award-card.module';
import { AwardsPage } from './awards.page';


describe('AwardsPage', () => {
  let spectator: Spectator<AwardsPage>;
  const createComponent = createRoutingFactory({
    component: AwardsPage,
    providers: [ DataService ],
    imports: [AwardsCardModule]
  });


  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
