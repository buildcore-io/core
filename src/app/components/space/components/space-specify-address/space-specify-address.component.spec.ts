import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpaceSpecifyAddressComponent } from './space-specify-address.component';

describe('SpaceSpecifyAddressComponent', () => {
  let component: SpaceSpecifyAddressComponent;
  let fixture: ComponentFixture<SpaceSpecifyAddressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SpaceSpecifyAddressComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SpaceSpecifyAddressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
