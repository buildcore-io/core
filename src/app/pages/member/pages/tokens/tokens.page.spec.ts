import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokensPage } from './tokens.page';


describe('TokensPage', () => {
  let component: TokensPage;
  let fixture: ComponentFixture<TokensPage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokensPage ]
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
