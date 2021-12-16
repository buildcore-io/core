import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { BehaviorSubject, Observable } from 'rxjs';
import { AwardCardComponent } from '../../../../components/award/components/award-card/award-card.component';
import { AwardApi } from './../../../../@api/award.api';
import { FilterService } from './../../services/filter.service';
import { SortOptions } from "../../services/sort-options.interface";
import { AwardsPage } from './awards.page';

describe('AwardsPage', () => {
  let spectator: Spectator<AwardsPage>;
  const createComponent = createRoutingFactory({
    component: AwardsPage,
    declarations: [MockComponent(AwardCardComponent)],
    providers: [MockProvider(<any>FilterService, {
      getHandler: () => {
        return new Observable();
      },
      selectedSort$: new BehaviorSubject<SortOptions>(SortOptions.OLDEST),
      search$: new BehaviorSubject<any>(undefined)
    }), MockProvider(AwardApi, {
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
