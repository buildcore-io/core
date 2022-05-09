import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenBidComponent } from './token-bid.component';


describe('TokenBidComponent', () => {
  let component: TokenBidComponent;
  let fixture: ComponentFixture<TokenBidComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenBidComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenBidComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
