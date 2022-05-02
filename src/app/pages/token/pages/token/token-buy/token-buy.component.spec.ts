import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenBuyComponent } from './token-buy.component';


describe('TokenBuyComponent', () => {
  let component: TokenBuyComponent;
  let fixture: ComponentFixture<TokenBuyComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenBuyComponent ]
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
