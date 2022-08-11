import { AfterViewChecked, ChangeDetectionStrategy, ChangeDetectorRef, Component, ComponentFactoryResolver, Input, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, MenuItem } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { UntilDestroy } from '@ngneat/until-destroy';
import { MenuItemDirective } from '../menu/menu-item.directive';

@UntilDestroy()
@Component({
  selector: 'wen-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavigationComponent implements AfterViewChecked {
  @Input() set items(value: MenuItem[]) {
    this.menuItems = value;
    this.reCreateIcons = true;
  }
  public menuItems: MenuItem[] = []
  @ViewChildren(MenuItemDirective) menuItemLabels!: QueryList<MenuItemDirective>;
  private reCreateIcons = false;

  constructor(
    public auth: AuthService,
    public deviceService: DeviceService,
    private router: Router,
    private componentFactoryResolver: ComponentFactoryResolver,
    private cd: ChangeDetectorRef
  ) {}

  loadIconComponents() {
    if (this.menuItemLabels) {
      for (const itemLabel of this.menuItemLabels.toArray()) {
        const iconComponent = this.componentFactoryResolver.resolveComponentFactory(itemLabel.wenMenuItem?.icon);
        itemLabel.viewContainerRef.clear();
        itemLabel.viewContainerRef.createComponent(iconComponent);
        this.cd.markForCheck();
      }
    }
  }

  public ngAfterViewChecked(): void {
    if (this.reCreateIcons) {
      this.loadIconComponents();
      this.reCreateIcons = false;
    }
  }

  public isSelectedRoute(route: any[]): boolean {
    if (this.router.isActive(this.router.createUrlTree(route), {paths: 'subset', queryParams: 'subset', fragment: 'ignored', matrixParams: 'ignored'})) {
      return true;
    }

    return false;
  }

  public trackByTitle(index: number, item: MenuItem): string {
    return item.title;
  }
}
