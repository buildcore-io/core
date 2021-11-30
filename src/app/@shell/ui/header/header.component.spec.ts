import { SignInModalComponent } from '@components/auth/components/sign-in-modal/sign-in-modal.component';
import { IconModule } from '@components/icon/icon.module';
import { MenuItemComponent } from '@components/menu/menu-item/menu-item.component';
import { MenuComponent } from '@components/menu/menu.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent } from 'ng-mocks';
import { SignInComponent } from './../../../components/auth/components/sign-in/sign-in.component';
import { SignOutComponent } from './../../../components/auth/components/sign-out/sign-out.component';
import { AuthService } from './../../../components/auth/services/auth.service';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let spectator: Spectator<HeaderComponent>;
  const createComponent = createRoutingFactory({
    component: HeaderComponent,
    imports: [IconModule],
    declarations: [MockComponent(SignInComponent), MockComponent(SignOutComponent), MockComponent(SignInModalComponent), MockComponent(MenuComponent), MockComponent(MenuItemComponent)],
    providers: [AuthService],
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
