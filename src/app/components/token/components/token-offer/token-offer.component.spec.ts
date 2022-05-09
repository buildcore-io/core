import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenOfferComponent } from './token-offer.component';


describe('TokenOfferComponent', () => {
  let component: TokenOfferComponent;
  let fixture: ComponentFixture<TokenOfferComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TokenOfferComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenOfferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
