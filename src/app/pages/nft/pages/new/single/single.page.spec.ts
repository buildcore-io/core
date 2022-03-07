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
import { SinglePage } from './single.page';


describe('SinglePage', () => {
  let component: SinglePage;
  let fixture: ComponentFixture<SinglePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SinglePage ],
      providers: [
        MockProvider(CacheService),
        MockProvider(DataService),
        MockProvider(NzNotificationService),
        MockProvider(NftApi),
        MockProvider(ActivatedRoute),
        MockProvider(AuthService),
        MockProvider(MemberApi),
        MockProvider(Router),
        MockProvider(FileApi)
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SinglePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
