import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberApi } from '@api/member.api';
import { MockProvider } from 'ng-mocks';
import { NftSaleFixedPriceComponent } from './nft-sale-fixed-price.component';


describe('NftSaleFixedPriceComponent', () => {
  let component: NftSaleFixedPriceComponent;
  let fixture: ComponentFixture<NftSaleFixedPriceComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NftSaleFixedPriceComponent ],
      providers: [ MockProvider(MemberApi) ]
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
