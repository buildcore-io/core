import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { MenuItemDirective } from './menu-item.directive';
import { MenuComponent } from './menu.component';

describe('MenuComponent', () => {
  let spectator: Spectator<MenuComponent>;
  const createComponent = createRoutingFactory({
    component: MenuComponent,
    declarations: [ MenuItemDirective ],
    imports: [ NzLayoutModule, NzMenuModule ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
