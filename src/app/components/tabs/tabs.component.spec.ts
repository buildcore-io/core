import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { TabsComponent } from './tabs.component';


describe('TabsComponent', () => {
  let spectator: Spectator<TabsComponent>;

  const createComponent = createRoutingFactory({
    component: TabsComponent,
    imports: [NzMenuModule]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should create', () => {
    expect(spectator).toBeTruthy();
  });
});
