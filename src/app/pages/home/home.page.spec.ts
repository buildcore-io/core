import { AwardCardModule } from '@components/award/components/award-card/award-card.module';
import { SpaceCardModule } from "@components/space/components/space-card/space-card.module";
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockProvider } from 'ng-mocks';
import { Observable } from 'rxjs';
import { AwardApi } from './../../@api/award.api';
import { SpaceApi } from './../../@api/space.api';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let spectator: Spectator<HomePage>;
  const createComponent = createRoutingFactory({
    component: HomePage,
    providers: [MockProvider(SpaceApi, {
      last: () => {
        return new Observable();
      }
    }),MockProvider(AwardApi, {
      last: () => {
        return new Observable();
      }
    })],
    imports: [
      AwardCardModule,
      SpaceCardModule
    ]
  });


  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
