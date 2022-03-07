import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { MemberApi } from '@api/member.api';
import { NftApi } from '@api/nft.api';
import { SpaceApi } from '@api/space.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DataService } from '@pages/nft/services/data.service';
import { MockProvider } from 'ng-mocks';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NFTPage } from './nft.page';


describe('NFTPage', () => {
  let component: NFTPage;
  let fixture: ComponentFixture<NFTPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NFTPage ],
      providers: [
        MockProvider(DataService),
        MockProvider(ActivatedRoute),
        MockProvider(AuthService),
        MockProvider(MemberApi),
        MockProvider(SpaceApi),
        MockProvider(CollectionApi),
        MockProvider(NftApi),
        MockProvider(NzNotificationService),
        MockProvider(Router)
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NFTPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
