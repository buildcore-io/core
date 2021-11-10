import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FundingPage } from './funding.page';


describe('FundingPage', () => {
  let component: FundingPage;
  let fixture: ComponentFixture<FundingPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FundingPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FundingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
