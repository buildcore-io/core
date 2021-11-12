import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberEditDrawerComponent } from './member-edit-drawer.component';

describe('MemberEditDrawerComponent', () => {
  let component: MemberEditDrawerComponent;
  let fixture: ComponentFixture<MemberEditDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MemberEditDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MemberEditDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
