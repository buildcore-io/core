import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataService } from '@pages/nft/services/data.service';
import { MockProvider } from 'ng-mocks';
import { TimelineNftComponent } from './timeline-nft.component';


describe('TimelineNftComponent', () => {
  let component: TimelineNftComponent;
  let fixture: ComponentFixture<TimelineNftComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TimelineNftComponent ],
      providers: [ MockProvider(DataService) ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TimelineNftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
