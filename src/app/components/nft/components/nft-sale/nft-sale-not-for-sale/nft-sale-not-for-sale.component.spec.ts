import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NftSaleNotForSaleComponent } from './nft-sale-not-for-sale.component';

describe('NftSaleNotForSaleComponent', () => {
  let component: NftSaleNotForSaleComponent;
  let fixture: ComponentFixture<NftSaleNotForSaleComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NftSaleNotForSaleComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NftSaleNotForSaleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
