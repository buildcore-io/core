import { AuthService } from '@components/auth/services/auth.service';
import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { MockProvider } from 'ng-mocks';
import { SignInPage } from './sign-in.page';

describe('SignInPage', () => {
  let spectator: Spectator<SignInPage>;
  const createComponent = createRoutingFactory({
    component: SignInPage,
    providers: [MockProvider(AuthService)],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should have button defined', () => {
    expect(spectator.query('button')).toBeDefined();
  });
});
