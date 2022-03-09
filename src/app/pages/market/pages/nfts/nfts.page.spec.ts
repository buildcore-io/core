import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NftApi } from '@api/nft.api';
import { CacheService } from '@core/services/cache/cache.service';
import { FilterService } from '@pages/market/services/filter.service';
import { MockProvider } from 'ng-mocks';
import { NFTsPage } from './nfts.page';


describe('NFTsPage', () => {
  let component: NFTsPage;
  let fixture: ComponentFixture<NFTsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NFTsPage ],
      providers: [FilterService, MockProvider(CacheService), MockProvider(NftApi)]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NFTsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
