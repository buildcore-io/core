import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NftApi } from '@api/nft.api';
import { CacheService } from '@core/services/cache/cache.service';
import { Collection, Space } from "@functions/interfaces/models";
import { FilterService } from '@pages/market/services/filter.service';
import { MockProvider } from 'ng-mocks';
import { BehaviorSubject } from "rxjs";
import { NFTsPage } from './nfts.page';


describe('NFTsPage', () => {
  let component: NFTsPage;
  let fixture: ComponentFixture<NFTsPage>;
  const allSpaces$ = new BehaviorSubject<Space[]>([]);
  const allCollections$ = new BehaviorSubject<Collection[]>([]);

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NFTsPage ],
      providers: [FilterService, MockProvider(CacheService, {allSpaces$, allCollections$}), MockProvider(NftApi)],
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

