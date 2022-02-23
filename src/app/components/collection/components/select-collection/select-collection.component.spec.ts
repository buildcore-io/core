import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectCollectionComponent } from './select-collection.component';

describe('SelectCollectionComponent', () => {
  let component: SelectCollectionComponent;
  let fixture: ComponentFixture<SelectCollectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SelectCollectionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectCollectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
