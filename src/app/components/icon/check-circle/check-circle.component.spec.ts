import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckCircleComponent } from './check-circle.component';

describe('CheckCircleComponent', () => {
  let component: CheckCircleComponent;
  let fixture: ComponentFixture<CheckCircleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CheckCircleComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CheckCircleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
