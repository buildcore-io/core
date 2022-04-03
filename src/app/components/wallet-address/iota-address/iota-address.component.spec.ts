import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderApi } from '@api/order.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { MockProvider } from 'ng-mocks';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { IOTAAddressComponent } from './iota-address.component';


describe('IOTAAddressComponent', () => {
  let component: IOTAAddressComponent;
  let fixture: ComponentFixture<IOTAAddressComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ IOTAAddressComponent ],
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
    fixture = TestBed.createComponent(IOTAAddressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
