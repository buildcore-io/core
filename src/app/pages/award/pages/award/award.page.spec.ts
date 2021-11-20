import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from "@pages/award/services/data.service";
import { MockProvider } from 'ng-mocks';
import { Observable } from 'rxjs';
import { AwardApi } from './../../../../@api/award.api';
import { TabsModule } from './../../../../components/tabs/tabs.module';
import { AwardPage } from './award.page';


describe('AwardPage', () => {
  let spectator: Spectator<AwardPage>;
  const createComponent = createRoutingFactory({
    component: AwardPage,
    providers: [ DataService, MockProvider(AwardApi, {
      last: () => {
        return new Observable();
      }
    })],
    imports: [ TabsModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});

