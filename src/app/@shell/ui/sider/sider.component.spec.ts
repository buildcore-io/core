import { GlobeIconComponent } from '@components/ui/components/icon/globe/globe.component';
import { ThemeService } from '@core/services/theme';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { MoonIconComponent } from './../../../components/ui/components/icon/moon/moon.component';
import { SunIconComponent } from './../../../components/ui/components/icon/sun/sun.component';
import { MenuItemDirective } from './menu/menu-item.directive';
import { MenuComponent } from './menu/menu.component';
import { SiderComponent } from './sider.component';
import { ThemeSwitchComponent } from './theme-switch/theme-switch.component';

describe('SiderComponent', () => {
  let spectator: Spectator<SiderComponent>;
  const createComponent = createRoutingFactory({
    component: SiderComponent,
    entryComponents: [ GlobeIconComponent ],
    declarations: [
      MockComponent(ThemeSwitchComponent),
      MockComponent(MenuComponent),
      MenuItemDirective,
      GlobeIconComponent,
      SunIconComponent,
      MoonIconComponent
    ],
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
