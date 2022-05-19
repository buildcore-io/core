import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenClaimRefundComponent } from './token-claim-refund.component';


describe('TokenClaimRefundComponent', () => {
  let component: TokenClaimRefundComponent;
  let fixture: ComponentFixture<TokenClaimRefundComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenClaimRefundComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenClaimRefundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
