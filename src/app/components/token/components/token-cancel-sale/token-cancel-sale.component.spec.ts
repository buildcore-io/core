import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenCancelSaleComponent } from './token-cancel-sale.component';


describe('TokenCancelSaleComponent', () => {
  let component: TokenCancelSaleComponent;
  let fixture: ComponentFixture<TokenCancelSaleComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenCancelSaleComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenCancelSaleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
