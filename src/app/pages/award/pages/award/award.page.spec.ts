import { IconModule } from '@components/icon/icon.module';
import { IpfsAvatarModule } from "@core/pipes/ipfs-avatar/ipfs-avatar.module";
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from "@pages/award/services/data.service";
import { MockProvider } from 'ng-mocks';
import { Observable } from 'rxjs';
import { AwardApi } from './../../../../@api/award.api';
import { IpfsBadgeModule } from './../../../../@core/pipes/ipfs-badge/ipfs-badge.module';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { TabsModule } from './../../../../components/tabs/tabs.module';
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
    imports: [TabsModule, IconModule, IpfsBadgeModule, IpfsAvatarModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});

