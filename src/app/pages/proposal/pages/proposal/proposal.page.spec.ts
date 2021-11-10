import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProposalPage } from './proposal.page';


describe('ProposalPage', () => {
  let component: ProposalPage;
  let fixture: ComponentFixture<ProposalPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProposalPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProposalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
