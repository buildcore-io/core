import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MenuItemDirective } from './menu-item.directive';
import { MenuComponent } from './menu.component';

describe('MenuComponent', () => {
  let spectator: Spectator<MenuComponent>;
  const createComponent = createRoutingFactory({
    component: MenuComponent,
    declarations: [ MenuItemDirective ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
