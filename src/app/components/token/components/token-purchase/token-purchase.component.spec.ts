import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenPurchaseComponent } from './token-purchase.component';


describe('TokenPurchaseComponent', () => {
  let component: TokenPurchaseComponent;
  let fixture: ComponentFixture<TokenPurchaseComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenPurchaseComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenPurchaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
