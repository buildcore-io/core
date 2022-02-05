import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberAlliancesTableComponent } from './member-alliances-table.component';

describe('MemberAlliancesTableComponent', () => {
  let component: MemberAlliancesTableComponent;
  let fixture: ComponentFixture<MemberAlliancesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MemberAlliancesTableComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MemberAlliancesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
