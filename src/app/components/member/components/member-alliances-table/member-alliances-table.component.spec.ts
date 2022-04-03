import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionApi } from '@api/collection.api';
import { SpaceApi } from '@api/space.api';
import { CacheService } from '@core/services/cache/cache.service';
import { MockProvider } from 'ng-mocks';
import { MemberAlliancesTableComponent } from './member-alliances-table.component';


describe('MemberAlliancesTableComponent', () => {
  let component: MemberAlliancesTableComponent;
  let fixture: ComponentFixture<MemberAlliancesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MemberAlliancesTableComponent],
      providers: [
        MockProvider(SpaceApi),
        MockProvider(CollectionApi),
        MockProvider(CacheService)
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MemberAlliancesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
