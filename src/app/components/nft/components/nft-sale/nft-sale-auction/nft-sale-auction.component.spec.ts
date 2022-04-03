import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NftSaleAuctionComponent } from './nft-sale-auction.component';

describe('NftSaleAuctionComponent', () => {
  let component: NftSaleAuctionComponent;
  let fixture: ComponentFixture<NftSaleAuctionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NftSaleAuctionComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NftSaleAuctionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
