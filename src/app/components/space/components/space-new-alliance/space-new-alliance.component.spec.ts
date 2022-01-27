import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpaceNewAllianceComponent } from './space-new-alliance.component';

describe('SpaceNewAllianceComponent', () => {
  let component: SpaceNewAllianceComponent;
  let fixture: ComponentFixture<SpaceNewAllianceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SpaceNewAllianceComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SpaceNewAllianceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
