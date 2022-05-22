import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlgoliaToggleComponent } from './algolia-toggle.component';


describe('AlgoliaToggleComponent', () => {
  let component: AlgoliaToggleComponent;
  let fixture: ComponentFixture<AlgoliaToggleComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ AlgoliaToggleComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AlgoliaToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
