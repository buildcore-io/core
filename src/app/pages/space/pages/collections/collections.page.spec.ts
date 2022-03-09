import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '@pages/space/services/data.service';
import { MockProvider } from 'ng-mocks';
import { CollectionsPage } from './collections.page';


describe('CollectionsPage', () => {
  let component: CollectionsPage;
  let fixture: ComponentFixture<CollectionsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CollectionsPage ],
      providers: [
        MockProvider(DataService),
        MockProvider(Router),
        MockProvider(ActivatedRoute)
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
