import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IOTAAddressComponent } from './iota-address.component';

describe('IOTAAddressComponent', () => {
  let component: IOTAAddressComponent;
  let fixture: ComponentFixture<IOTAAddressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ IOTAAddressComponent ]
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
