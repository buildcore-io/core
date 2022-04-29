import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WalletDeeplinkComponent } from './wallet-deeplink.component';


describe('WalletDeeplinkComponent', () => {
  let component: WalletDeeplinkComponent;
  let fixture: ComponentFixture<WalletDeeplinkComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ WalletDeeplinkComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WalletDeeplinkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
