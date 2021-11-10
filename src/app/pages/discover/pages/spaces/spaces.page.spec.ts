import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpacesModule } from '@components/spaces/spaces.module';
import { SpacesPage } from './spaces.page';


describe('SpacesPage', () => {
  let component: SpacesPage;
  let fixture: ComponentFixture<SpacesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SpacesPage],
      imports: [SpacesModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SpacesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
