import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { BehaviorSubject, Observable } from 'rxjs';
import { ProposalCardComponent } from '../../../../components/proposal/components/proposal-card/proposal-card.component';
import { ProposalApi } from './../../../../@api/proposal.api';
import { FilterService } from './../../services/filter.service';
import { SortOptions } from "../../services/sort-options.interface";
import { ProposalsPage } from './proposals.page';


describe('ProposalsPage', () => {
  let spectator: Spectator<ProposalsPage>;
  const createComponent = createRoutingFactory({
    component: ProposalsPage,
    declarations: [MockComponent(ProposalCardComponent)],
    providers: [MockProvider(<any>FilterService, {
      getHandler: () => {
        return new Observable();
      },
      selectedSort$: new BehaviorSubject<SortOptions>(SortOptions.OLDEST),
      search$: new BehaviorSubject<any>(undefined)
    }), MockProvider(ProposalApi, {
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
