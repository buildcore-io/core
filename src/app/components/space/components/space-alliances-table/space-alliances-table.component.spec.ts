import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpaceAlliancesTableComponent } from './space-alliances-table.component';

describe('SpaceAlliancesTableComponent', () => {
  let component: SpaceAlliancesTableComponent;
  let fixture: ComponentFixture<SpaceAlliancesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SpaceAlliancesTableComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SpaceAlliancesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
