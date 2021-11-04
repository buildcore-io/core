import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MoonComponent } from './moon.component';

describe('MoonComponent', () => {
  let component: MoonComponent;
  let fixture: ComponentFixture<MoonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MoonComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MoonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
