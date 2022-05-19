import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalDrawerComponent } from './modal-drawer.component';


describe('ModalDrawerComponent', () => {
  let component: ModalDrawerComponent;
  let fixture: ComponentFixture<ModalDrawerComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ ModalDrawerComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
