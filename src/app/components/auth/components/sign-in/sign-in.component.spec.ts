import { AuthService } from '@components/auth/services/auth.service';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockProvider } from 'ng-mocks';
import { SignInComponent } from './sign-in.component';

describe('SignInComponent', () => {
  let spectator: Spectator<SignInComponent>;
  const createComponent = createRoutingFactory({
    component: SignInComponent,
    providers: [MockProvider(AuthService)],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
