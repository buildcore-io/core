import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpaceVerifyIOTAAddressComponent } from './space-verify-iota-address.component';

describe('SpaceVerifyIOTAAddressComponent', () => {
  let component: SpaceVerifyIOTAAddressComponent;
  let fixture: ComponentFixture<SpaceVerifyIOTAAddressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SpaceVerifyIOTAAddressComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SpaceVerifyIOTAAddressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
