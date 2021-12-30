import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwardAwardsComponent } from './award-awards.component';

describe('AwardAwardsComponent', () => {
  let component: AwardAwardsComponent;
  let fixture: ComponentFixture<AwardAwardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwardAwardsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwardAwardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
