import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberApi } from '@api/member.api';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { MockProvider } from 'ng-mocks';
import { TokenPublicSaleComponent } from './token-public-sale.component';


describe('TokenPublicSaleComponent', () => {
  let component: TokenPublicSaleComponent;
  let fixture: ComponentFixture<TokenPublicSaleComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenPublicSaleComponent ],
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
    fixture = TestBed.createComponent(TokenPublicSaleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
