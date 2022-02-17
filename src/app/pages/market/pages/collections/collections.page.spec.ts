import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionsPage } from './collections.page';


describe('CollectionsPage', () => {
  let component: CollectionsPage;
  let fixture: ComponentFixture<CollectionsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CollectionsPage ]
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
