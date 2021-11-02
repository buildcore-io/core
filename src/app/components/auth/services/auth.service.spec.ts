import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { MockProvider } from 'ng-mocks';
import { first } from "rxjs";
import { MemberApi } from './../../../@api/member.api';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let spectator: SpectatorService<AuthService>;
  const createService = createServiceFactory({
    service: AuthService,
    providers: [
      MockProvider(MemberApi)
    ]
  });

  beforeEach(() => spectator = createService());

  it('should not be logged in', () => {
    spectator.service.isLoggedIn$.pipe(first()).subscribe((val) => {
      expect(val).toBeFalsy();
    })
  });
});
