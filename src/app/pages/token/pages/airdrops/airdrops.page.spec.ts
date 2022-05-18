import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MemberApi } from '@api/member.api';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { MockProvider } from 'ng-mocks';
import { AirdropsPage } from './airdrops.page';


describe('AirdropsPage', () => {
  let component: AirdropsPage;
  let fixture: ComponentFixture<AirdropsPage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ AirdropsPage ],
      providers: [
        MockProvider(AuthService),
        MockProvider(MemberApi),
        MockProvider(NotificationService),
        MockProvider(Router),
        MockProvider(TokenApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AirdropsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
