import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberSpaceRowComponent } from './member-space-row.component';

describe('MemberSpaceRowComponent', () => {
  let component: MemberSpaceRowComponent;
  let fixture: ComponentFixture<MemberSpaceRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MemberSpaceRowComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MemberSpaceRowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
