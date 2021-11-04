import { ThemeService } from '@core/services/theme';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockProvider } from 'ng-mocks';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { SiderComponent } from './sider.component';
import { ThemeSwitchComponent } from './theme-switch/theme-switch.component';

describe('SiderComponent', () => {
  let spectator: Spectator<SiderComponent>;
  const createComponent = createRoutingFactory({
    component: SiderComponent,
    declarations: [ThemeSwitchComponent],
    imports: [NzLayoutModule, NzIconModule, NzDropDownModule],
    providers: [MockProvider(ThemeService)],
    params: {},
    data: {}
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('write tests', () => {
    expect(spectator).toBeDefined();
  });
});
