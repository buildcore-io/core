import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProposalsPage } from './proposals.page';


describe('ProposalsPage', () => {
  let component: ProposalsPage;
  let fixture: ComponentFixture<ProposalsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProposalsPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProposalsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
