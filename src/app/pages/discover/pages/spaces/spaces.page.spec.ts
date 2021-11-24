import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockProvider } from 'ng-mocks';
import { BehaviorSubject, Observable } from 'rxjs';
import { SpaceCardModule } from '../../../../components/space/components/space-card/space-card.module';
import { SpaceApi } from './../../../../@api/space.api';
import { FilterService, SortOptions } from './../../services/filter.service';
import { SpacesPage } from './spaces.page';

describe('SpacesPage', () => {
  let spectator: Spectator<SpacesPage>;
  const createComponent = createRoutingFactory({
    component: SpacesPage,
    imports: [SpaceCardModule],
    providers: [MockProvider(<any>FilterService, {
      getHandler: () => {
        return new Observable();
      },
      selectedSort$: new BehaviorSubject<SortOptions>(SortOptions.OLDEST)
    }), MockProvider(SpaceApi, {
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
