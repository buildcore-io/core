import { AuthService } from '@components/auth/services/auth.service';
import { IconModule } from '@components/icon/icon.module';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { SignInComponent } from './../../../components/auth/components/sign-in/sign-in.component';
import { SignOutComponent } from './../../../components/auth/components/sign-out/sign-out.component';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let spectator: Spectator<HeaderComponent>;
  const createComponent = createRoutingFactory({
    component: HeaderComponent,
    imports: [IconModule],
    declarations: [MockComponent(SignInComponent), MockComponent(SignOutComponent)],
    providers: [MockProvider(AuthService)],
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
