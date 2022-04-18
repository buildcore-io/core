import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { FileApi } from '@api/file.api';
import { MemberApi } from '@api/member.api';
import { NftApi } from '@api/nft.api';
import { AuthService } from '@components/auth/services/auth.service';
import { CacheService } from '@core/services/cache/cache.service';
import { DataService } from '@pages/nft/services/data.service';
import { MockProvider } from 'ng-mocks';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { MultiplePage } from './multiple.page';


describe('MultiplePage', () => {
  let component: MultiplePage;
  let fixture: ComponentFixture<MultiplePage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ MultiplePage ],
      providers: [
        MockProvider(CacheService),
        MockProvider(DataService),
        MockProvider(NzNotificationService),
        MockProvider(AuthService),
        MockProvider(MemberApi),
        MockProvider(FileApi),
        MockProvider(ActivatedRoute),
        MockProvider(Router),
        MockProvider(NftApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MultiplePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
