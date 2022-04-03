import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileApi } from '@api/file.api';
import { MemberApi } from '@api/member.api';
import { NftApi } from '@api/nft.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { MockProvider } from 'ng-mocks';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NftSaleComponent } from './nft-sale.component';


describe('NftSaleComponent', () => {
  let component: NftSaleComponent;
  let fixture: ComponentFixture<NftSaleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NftSaleComponent ],
      providers: [
        MockProvider(FileApi),
        MockProvider(MemberApi),
        MockProvider(AuthService),
        MockProvider(NotificationService),
        MockProvider(NzNotificationService),
        MockProvider(NftApi)
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NftSaleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
