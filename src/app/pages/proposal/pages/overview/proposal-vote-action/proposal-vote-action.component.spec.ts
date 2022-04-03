import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@components/auth/services/auth.service';
import { DataService } from '@pages/proposal/services/data.service';
import { MockProvider } from 'ng-mocks';
import { ProposalVoteActionComponent } from './proposal-vote-action.component';


describe('ProposalVoteActionComponent', () => {
  let component: ProposalVoteActionComponent;
  let fixture: ComponentFixture<ProposalVoteActionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProposalVoteActionComponent ],
      providers: [MockProvider(AuthService), MockProvider(DataService)]
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
