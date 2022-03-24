import { IconModule } from '@components/icon/icon.module';
import { ShareModule } from '@components/share/share.module';
import { IpfsAvatarModule } from "@core/pipes/ipfs-avatar/ipfs-avatar.module";
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from "@pages/award/services/data.service";
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { MockProvider } from 'ng-mocks';
import { Observable } from 'rxjs';
import { AwardApi } from './../../../../@api/award.api';
import { IpfsBadgeModule } from './../../../../@core/pipes/ipfs-badge/ipfs-badge.module';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { AwardAwardsModule } from './../../../../components/award/components/award-awards/award-awards.module';
import { AwardStatusModule } from './../../../../components/award/components/award-status/award-status.module';
import { DrawerToggleModule } from './../../../../components/drawer-toggle/drawer-toggle.module';
import { TabsModule } from './../../../../components/tabs/tabs.module';
import { AwardInfoModule } from './award-info/award-info.module';
import { AwardPage } from './award.page';


describe('AwardPage', () => {
  let spectator: Spectator<AwardPage>;
  const createComponent = createRoutingFactory({
    component: AwardPage,
    providers: [NavigationService, DataService, MockProvider(AwardApi, {
      last: () => {
        return new Observable();
      }
    })],
    imports: [TabsModule, IconModule, IpfsBadgeModule, IpfsAvatarModule, AwardStatusModule, LayoutModule, DrawerToggleModule, AwardInfoModule, AwardAwardsModule, ShareModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});

