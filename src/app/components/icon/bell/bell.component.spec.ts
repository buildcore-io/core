import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BellComponent } from './bell.component';

describe('BellComponent', () => {
  let component: BellComponent;
  let fixture: ComponentFixture<BellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BellComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
