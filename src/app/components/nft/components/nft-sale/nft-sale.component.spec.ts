import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileApi } from '@api/file.api';
import { MemberApi } from '@api/member.api';
import { AuthService } from '@components/auth/services/auth.service';
import { MockProvider } from 'ng-mocks';
import { NftSaleComponent } from './nft-sale.component';


describe('NftSaleComponent', () => {
  let component: NftSaleComponent;
  let fixture: ComponentFixture<NftSaleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NftSaleComponent ],
      providers: [
        MockProvider(FileApi),
        MockProvider(MemberApi),
        MockProvider(AuthService)
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NftSaleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
