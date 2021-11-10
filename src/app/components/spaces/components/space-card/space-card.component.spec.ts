import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { IconModule } from './../../../../components/ui/components/icon/icon.module';
import { SpaceCardComponent } from './space-card.component';


describe('SpaceCardComponent', () => {
  let component: SpaceCardComponent;
  let fixture: ComponentFixture<SpaceCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SpaceCardComponent],
      imports: [IconModule, NzAvatarModule]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SpaceCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
