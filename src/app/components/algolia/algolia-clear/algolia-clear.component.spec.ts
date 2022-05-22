import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlgoliaClearComponent } from './algolia-clear.component';


describe('AlgoliaClearComponent', () => {
  let component: AlgoliaClearComponent;
  let fixture: ComponentFixture<AlgoliaClearComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ AlgoliaClearComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AlgoliaClearComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
