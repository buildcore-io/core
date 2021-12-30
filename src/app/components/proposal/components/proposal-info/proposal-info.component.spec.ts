import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalInfoComponent } from './proposal-info.component';

describe('ProposalInfoComponent', () => {
  let component: ProposalInfoComponent;
  let fixture: ComponentFixture<ProposalInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProposalInfoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProposalInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
