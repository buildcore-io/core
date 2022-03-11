import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AwardApi } from '@api/award.api';
import { CollectionApi } from '@api/collection.api';
import { FileApi } from '@api/file.api';
import { MemberApi } from '@api/member.api';
import { SpaceApi } from '@api/space.api';
import { CacheService } from '@core/services/cache/cache.service';
import { NavigationService } from '@core/services/navigation/navigation.service';
import { NotificationService } from '@core/services/notification';
import { MockProvider } from 'ng-mocks';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { UpsertPage } from './upsert.page';


describe('UpsertPage', () => {
  let component: UpsertPage;
  let fixture: ComponentFixture<UpsertPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UpsertPage ],
      providers: [
        MockProvider(NavigationService),
        MockProvider(ActivatedRoute),
        MockProvider(CollectionApi),
        MockProvider(MemberApi),
        MockProvider(NotificationService),
        MockProvider(NzNotificationService),
        MockProvider(Router),
        MockProvider(FileApi),
        MockProvider(AwardApi),
        MockProvider(SpaceApi),
        MockProvider(CacheService)
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UpsertPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
