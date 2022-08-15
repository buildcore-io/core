import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderApi } from '@api/order.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { MockProvider } from 'ng-mocks';
import { NzNotificationService } from 'ng-zorro-antd/notification';

import { VerifyAddressComponent } from './verify-address.component';

describe('VerifyAddressComponent', () => {
  let component: VerifyAddressComponent;
  let fixture: ComponentFixture<VerifyAddressComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ VerifyAddressComponent ],
      providers: [
        MockProvider(AuthService),
        MockProvider(NotificationService),
        MockProvider(NzNotificationService),
        MockProvider(OrderApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VerifyAddressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
