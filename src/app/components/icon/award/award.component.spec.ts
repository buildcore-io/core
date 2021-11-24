import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AwardComponent } from './award.component';

describe('AwardComponent', () => {
  let component: AwardComponent;
  let fixture: ComponentFixture<AwardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AwardComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AwardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
