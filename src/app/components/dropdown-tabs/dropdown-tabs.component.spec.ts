import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DropdownTabsComponent } from './dropdown-tabs.component';

describe('DropdownTabsComponent', () => {
  let component: DropdownTabsComponent;
  let fixture: ComponentFixture<DropdownTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DropdownTabsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DropdownTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
