import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectBoxOptionsComponent } from './select-box-options.component';

describe('SelectBoxOptionsComponent', () => {
  let component: SelectBoxOptionsComponent;
  let fixture: ComponentFixture<SelectBoxOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SelectBoxOptionsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectBoxOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
