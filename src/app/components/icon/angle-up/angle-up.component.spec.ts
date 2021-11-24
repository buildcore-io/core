import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AngleUpComponent } from './angle-up.component';

describe('AngleUpComponent', () => {
  let component: AngleUpComponent;
  let fixture: ComponentFixture<AngleUpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AngleUpComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AngleUpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
