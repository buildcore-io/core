import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberApi } from '@api/member.api';
import { DataService } from '@pages/member/services/data.service';
import { MockProvider } from 'ng-mocks';
import { TransactionsPage } from './transactions.page';


describe('TransactionsPage', () => {
  let component: TransactionsPage;
  let fixture: ComponentFixture<TransactionsPage>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ TransactionsPage ],
      providers: [
        MockProvider(DataService),
        MockProvider(MemberApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
