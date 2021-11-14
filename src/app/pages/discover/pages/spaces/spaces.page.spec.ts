import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockProvider } from 'ng-mocks';
import { Observable } from 'rxjs';
import { SpaceApi } from './../../../../@api/space.api';
import { SpaceCardModule } from './../../../../components/spaces/components/space-card/space-card.module';
import { SpacesPage } from './spaces.page';

describe('SpacesPage', () => {
  let spectator: Spectator<SpacesPage>;
  const createComponent = createRoutingFactory({
    component: SpacesPage,
    imports: [SpaceCardModule],
    providers: [MockProvider(SpaceApi, {
      last: () => {
        return new Observable();
      }
    })]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
