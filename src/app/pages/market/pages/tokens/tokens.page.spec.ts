import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenApi } from '@api/token.api';
import { CacheService } from '@core/services/cache/cache.service';
import { MockProvider } from 'ng-mocks';
import { TokensPage } from './tokens.page';


describe('TokensPage', () => {
  let component: TokensPage;
  let fixture: ComponentFixture<TokensPage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokensPage ],
      providers: [
        MockProvider(CacheService),
        MockProvider(TokenApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokensPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
