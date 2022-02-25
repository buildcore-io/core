import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WalletAddressComponent } from './wallet-address.component';

describe('WalletAddressComponent', () => {
  let component: WalletAddressComponent;
  let fixture: ComponentFixture<WalletAddressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WalletAddressComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WalletAddressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
