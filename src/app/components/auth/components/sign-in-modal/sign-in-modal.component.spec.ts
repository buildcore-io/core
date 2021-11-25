import { AuthService } from '@components/auth/services/auth.service';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockComponent, MockProvider } from 'ng-mocks';
import { SignInComponent } from '../sign-in/sign-in.component';
import { SignOutComponent } from '../sign-out/sign-out.component';
import { SignInModalComponent } from './sign-in-modal.component';

describe('Sig', () => {
  let spectator: Spectator<SignInModalComponent>;
  const createComponent = createRoutingFactory({
    component: SignInModalComponent,
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