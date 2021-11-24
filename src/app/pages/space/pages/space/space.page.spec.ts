import { IconModule } from '@components/icon/icon.module';
import { TabsComponent } from '@components/tabs/tabs.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { DataService } from "@pages/space/services/data.service";
import { MockComponent } from 'ng-mocks';
import { SpacePage } from './space.page';

describe('SpacePage', () => {
  let spectator: Spectator<SpacePage>;
  const createComponent = createRoutingFactory({
    component: SpacePage,
    imports: [IconModule],
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
