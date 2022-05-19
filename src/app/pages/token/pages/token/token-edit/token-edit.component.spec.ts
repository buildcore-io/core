import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberApi } from '@api/member.api';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { MockProvider } from 'ng-mocks';
import { TokenEditComponent } from './token-edit.component';


describe('TokenEditComponent', () => {
  let component: TokenEditComponent;
  let fixture: ComponentFixture<TokenEditComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenEditComponent ],
      providers: [
        MockProvider(AuthService),
        MockProvider(MemberApi),
        MockProvider(NotificationService),
        MockProvider(TokenApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
