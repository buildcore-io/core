import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { MemberApi } from '@api/member.api';
import { NftApi } from '@api/nft.api';
import { SpaceApi } from '@api/space.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { DataService } from '@pages/collection/services/data.service';
import { FilterService } from '@pages/market/services/filter.service';
import { MockProvider } from 'ng-mocks';
import { CollectionPage } from './collection.page';


describe('CollectionPage', () => {
  let component: CollectionPage;
  let fixture: ComponentFixture<CollectionPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CollectionPage ],
      providers: [
        FilterService,
        MockProvider(DataService),
        MockProvider(AuthService),
        MockProvider(NotificationService),
        MockProvider(SpaceApi),
        MockProvider(MemberApi),
        MockProvider(CollectionApi),
        MockProvider(NftApi),
        MockProvider(ActivatedRoute),
        MockProvider(Router)
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
