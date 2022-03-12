import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionApi } from '@api/collection.api';
import { SpaceApi } from '@api/space.api';
import { CacheService } from '@core/services/cache/cache.service';
import { FilterService } from '@pages/market/services/filter.service';
import { MockProvider } from 'ng-mocks';
import { CollectionsPage } from './collections.page';


describe('CollectionsPage', () => {
  let component: CollectionsPage;
  let fixture: ComponentFixture<CollectionsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CollectionsPage ],
      providers: [
        FilterService,
        MockProvider(CollectionApi),
        MockProvider(SpaceApi),
        MockProvider(CacheService)
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
