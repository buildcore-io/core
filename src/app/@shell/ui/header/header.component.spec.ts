import { SignInModalComponent } from '@components/auth/components/sign-in-modal/sign-in-modal.component';
import { IconModule } from '@components/icon/icon.module';
import { MenuItemComponent } from '@components/menu/menu-item/menu-item.component';
import { MenuComponent } from '@components/menu/menu.component';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent } from 'ng-mocks';
import { SignInComponent } from './../../../components/auth/components/sign-in/sign-in.component';
import { SignOutComponent } from './../../../components/auth/components/sign-out/sign-out.component';
import { AuthService } from './../../../components/auth/services/auth.service';
import { MobileHeaderModule } from './../mobile-header/mobile-header.module';
import { MobileMenuModule } from './../mobile-menu/mobile-menu.module';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let spectator: Spectator<HeaderComponent>;
  const createComponent = createRoutingFactory({
    component: HeaderComponent,
    imports: [IconModule, IpfsAvatarModule, MobileHeaderModule, MobileMenuModule],
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
