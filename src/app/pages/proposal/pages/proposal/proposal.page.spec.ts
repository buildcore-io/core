import { IpfsBadgeModule } from './../../../../@core/pipes/ipfs-badge/ipfs-badge.module';
import { BadgeModule } from "@components/badge/badge.module";
import { IconModule } from '@components/icon/icon.module';
import { TabsModule } from '@components/tabs/tabs.module';
import { IpfsAvatarModule } from "@core/pipes/ipfs-avatar/ipfs-avatar.module";
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { ProposalStatusModule } from './../../../../components/proposal/components/proposal-status/proposal-status.module';
import { DataService } from './../../services/data.service';
import { ProposalPage } from './proposal.page';

describe('ProposalPage', () => {
  let spectator: Spectator<ProposalPage>;
  const createComponent = createRoutingFactory({
    component: ProposalPage,
    imports: [ TabsModule, IconModule, ProposalStatusModule, BadgeModule, IpfsAvatarModule, IpfsBadgeModule ],
    providers: [ DataService ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
