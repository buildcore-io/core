import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpaceApi } from '@api/space.api';
import { AuthService } from '@components/auth/services/auth.service';
import { MockProvider } from 'ng-mocks';
import { TokenBuyComponent } from './token-buy.component';


describe('TokenBuyComponent', () => {
  let component: TokenBuyComponent;
  let fixture: ComponentFixture<TokenBuyComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenBuyComponent ],
      providers: [
        MockProvider(SpaceApi),
        MockProvider(AuthService)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenBuyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
