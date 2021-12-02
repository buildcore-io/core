import { AuthService } from '@components/auth/services/auth.service';
import { IconModule } from '@components/icon/icon.module';
import { MenuItemComponent } from '@components/menu/menu-item/menu-item.component';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { MemberApi } from './../../../../@api/member.api';
import { SignOutComponent } from './sign-out.component';

describe('SignOutComponent', () => {
  let spectator: Spectator<SignOutComponent>;
  const createComponent = createRoutingFactory({
    component: SignOutComponent,
    imports: [NzAvatarModule, NzTypographyModule, IconModule,],
    declarations: [MockComponent(MenuItemComponent)],
    providers: [
      MockProvider(AuthService),
      MockProvider(MemberApi),
      MockProvider(NzNotificationService)
    ],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
