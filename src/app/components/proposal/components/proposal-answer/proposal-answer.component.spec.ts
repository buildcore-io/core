import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalAnswerComponent } from './proposal-answer.component';

describe('ProposalAnswerComponent', () => {
  let component: ProposalAnswerComponent;
  let fixture: ComponentFixture<ProposalAnswerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProposalAnswerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProposalAnswerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
