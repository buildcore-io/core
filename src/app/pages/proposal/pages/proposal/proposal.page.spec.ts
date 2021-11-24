import { IconModule } from '@components/icon/icon.module';
import { TabsModule } from '@components/tabs/tabs.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from './../../services/data.service';
import { ProposalPage } from './proposal.page';

describe('ProposalPage', () => {
  let spectator: Spectator<ProposalPage>;
  const createComponent = createRoutingFactory({
    component: ProposalPage,
    imports: [ TabsModule, IconModule ],
    providers: [ DataService ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
