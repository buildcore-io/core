import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { Observable } from 'rxjs';
import { AwardApi } from './../../../../@api/award.api';
import { AwardCardComponent } from '../../../../components/award/components/award-card/award-card.component';
import { AwardsPage } from './awards.page';

describe('AwardsPage', () => {
  let spectator: Spectator<AwardsPage>;
  const createComponent = createRoutingFactory({
    component: AwardsPage,
    declarations: [MockComponent(AwardCardComponent)],
    providers: [MockProvider(AwardApi, {
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
