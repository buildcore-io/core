import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IpfsBadgeModule } from '@core/pipes/ipfs-badge/ipfs-badge.module';
import { DataService } from '@pages/collection/services/data.service';
import { CollectionAboutComponent } from './collection-about.component';


describe('CollectionAboutComponent', () => {
  let component: CollectionAboutComponent;
  let fixture: ComponentFixture<CollectionAboutComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ CollectionAboutComponent ],
      providers: [DataService],
      imports: [IpfsBadgeModule]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionAboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
