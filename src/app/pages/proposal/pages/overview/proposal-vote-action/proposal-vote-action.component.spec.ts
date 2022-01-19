import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalVoteActionComponent } from './proposal-vote-action.component';

describe('ProposalVoteActionComponent', () => {
  let component: ProposalVoteActionComponent;
  let fixture: ComponentFixture<ProposalVoteActionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProposalVoteActionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProposalVoteActionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
