import { RadioModule } from '@components/radio/radio.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MarkDownModule } from './../../../../@core/pipes/markdown/markdown.module';
import { RelativeTimeModule } from './../../../../@core/pipes/relative-time/relative-time.module';
import { DataService } from './../../services/data.service';
import { OverviewPage } from './overview.page';


describe('OverviewPage', () => {
  let spectator: Spectator<OverviewPage>;
  const createComponent = createRoutingFactory({
    component: OverviewPage,
    providers: [ DataService ],
    imports: [ MarkDownModule, RadioModule, RelativeTimeModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
