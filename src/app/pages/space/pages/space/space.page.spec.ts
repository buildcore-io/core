import { TabsComponent } from '@components/ui/components/tabs/tabs.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent } from 'ng-mocks';
import { SpacePage } from './space.page';

describe('SpacePage', () => {
  let spectator: Spectator<SpacePage>;
  const createComponent = createRoutingFactory({
    component: SpacePage,
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
