import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@components/auth/services/auth.service';
import { DataService } from '@pages/space/services/data.service';
import { MockProvider } from 'ng-mocks';
import { SpaceNewAllianceComponent } from './space-new-alliance.component';


describe('SpaceNewAllianceComponent', () => {
  let component: SpaceNewAllianceComponent;
  let fixture: ComponentFixture<SpaceNewAllianceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SpaceNewAllianceComponent ],
      providers: [MockProvider(DataService), MockProvider(AuthService)]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SpaceNewAllianceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
