import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenPublicSaleComponent } from './token-public-sale.component';


describe('TokenPublicSaleComponent', () => {
  let component: TokenPublicSaleComponent;
  let fixture: ComponentFixture<TokenPublicSaleComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenPublicSaleComponent ]
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
