import { GlobeIconComponent } from '@components/ui/components/icon/globe/globe.component';
import { ThemeService } from '@core/services/theme';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { MoonIconComponent } from './../../../components/ui/components/icon/moon/moon.component';
import { SunIconComponent } from './../../../components/ui/components/icon/sun/sun.component';
import { MemberTileComponent } from './../../../components/ui/components/member/tile/member-tile.component';
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
      MemberTileComponent,
      MenuItemDirective,
      GlobeIconComponent,
      SunIconComponent,
      MoonIconComponent
    ],
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
