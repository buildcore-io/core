import { IconModule } from '@components/icon/icon.module';
import { TabsComponent } from '@components/tabs/tabs.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from "@pages/space/services/data.service";
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { MockComponent } from 'ng-mocks';
import { IpfsAvatarModule } from './../../../../@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { MarkDownModule } from './../../../../@core/pipes/markdown/markdown.module';
import { SpacePage } from './space.page';

describe('SpacePage', () => {
  let spectator: Spectator<SpacePage>;
  const createComponent = createRoutingFactory({
    component: SpacePage,
    imports: [IconModule, IpfsAvatarModule, MarkDownModule, LayoutModule],
    providers: [ DataService ],
    declarations: [
      MockComponent(TabsComponent)
    ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
