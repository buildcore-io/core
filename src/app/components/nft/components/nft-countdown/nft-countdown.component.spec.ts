import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberApi } from '@api/member.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DataService } from '@pages/nft/services/data.service';
import { MockProvider } from 'ng-mocks';
import { NftCountdownComponent } from './nft-countdown.component';


describe('NftCountdownComponent', () => {
  let component: NftCountdownComponent;
  let fixture: ComponentFixture<NftCountdownComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NftCountdownComponent ],
      providers: [ 
        MockProvider(DataService),
        MockProvider(AuthService),
        MockProvider(MemberApi)
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NftCountdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
