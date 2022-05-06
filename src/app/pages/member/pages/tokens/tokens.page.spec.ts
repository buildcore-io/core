import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberApi } from '@api/member.api';
import { TokenApi } from '@api/token.api';
import { DataService } from '@pages/member/services/data.service';
import { MockProvider } from 'ng-mocks';
import { TokensPage } from './tokens.page';


describe('TokensPage', () => {
  let component: TokensPage;
  let fixture: ComponentFixture<TokensPage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokensPage ],
      providers: [
        MockProvider(DataService),
        MockProvider(MemberApi),
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
