import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NftSaleFixedPriceComponent } from './nft-sale-fixed-price.component';

describe('NftSaleFixedPriceComponent', () => {
  let component: NftSaleFixedPriceComponent;
  let fixture: ComponentFixture<NftSaleFixedPriceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NftSaleFixedPriceComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NftSaleFixedPriceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
