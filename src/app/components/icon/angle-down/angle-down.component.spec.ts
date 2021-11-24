import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AngleDownComponent } from './angle-down.component';

describe('AngleDownComponent', () => {
  let component: AngleDownComponent;
  let fixture: ComponentFixture<AngleDownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AngleDownComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AngleDownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
