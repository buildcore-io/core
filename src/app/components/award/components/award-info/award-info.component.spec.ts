import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwardInfoComponent } from './award-info.component';

describe('AwardInfoComponent', () => {
  let component: AwardInfoComponent;
  let fixture: ComponentFixture<AwardInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwardInfoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwardInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
