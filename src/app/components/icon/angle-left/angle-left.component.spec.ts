import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AngleLeftComponent } from './angle-left.component';

describe('AngleLeftComponent', () => {
  let component: AngleLeftComponent;
  let fixture: ComponentFixture<AngleLeftComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AngleLeftComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AngleLeftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
