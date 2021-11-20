import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MarkDownModule } from './../../../../@core/pipes/markdown/markdown.module';
import { DataService } from './../../services/data.service';
import { OverviewPage } from './overview.page';


describe('OverviewPage', () => {
  let spectator: Spectator<OverviewPage>;
  const createComponent = createRoutingFactory({
    component: OverviewPage,
    providers: [ DataService ],
    imports: [ MarkDownModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
