import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { Observable } from 'rxjs';
import { ProposalApi } from './../../../../@api/proposal.api';
import { ProposalCardComponent } from '../../../../components/proposal/components/proposal-card/proposal-card.component';
import { ProposalsPage } from './proposals.page';


describe('ProposalsPage', () => {
  let spectator: Spectator<ProposalsPage>;
  const createComponent = createRoutingFactory({
    component: ProposalsPage,
    declarations: [MockComponent(ProposalCardComponent)],
    providers: [MockProvider(ProposalApi, {
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
