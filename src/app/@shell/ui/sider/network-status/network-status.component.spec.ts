import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneApi } from '@api/milestone.api';
import { MilestoneAtoiApi } from '@api/milestone_atoi.api';
import { MilestoneRmsApi } from '@api/milestone_rms.api';
import { MockProvider } from 'ng-mocks';

import { NetworkStatusComponent } from './network-status.component';

describe('NetworkStatusComponent', () => {
  let component: NetworkStatusComponent;
  let fixture: ComponentFixture<NetworkStatusComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ NetworkStatusComponent ],
      providers: [
        MockProvider(MilestoneApi),
        MockProvider(MilestoneAtoiApi),
        MockProvider(MilestoneRmsApi)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NetworkStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
