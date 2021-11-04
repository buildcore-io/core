import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { NotFoundModule } from '@shell/ui/not-found/not-found.module';
import { FooterModule } from '../ui/footer/footer.module';
import { HeaderModule } from '../ui/header/header.module';
import { LayoutModule } from '../ui/layout/layout.module';
import { NotFoundPage } from '../ui/not-found/not-found.page';

const APP_ROUTES: Routes = [
  {
    path: ROUTER_UTILS.config.auth.root,
    loadChildren: async () =>
      (await import('@components/auth/auth.module')).AuthModule,
    canLoad: [],
  },
  {
    path: ROUTER_UTILS.config.base.home,
    loadChildren: async () =>
      (await import('@pages/home/home.module')).HomeModule,
  },
  {
    path: ROUTER_UTILS.config.base.dashboard,
    loadChildren: async () =>
      (await import('@pages/dashboard/dashboard.module')).DashboardModule,
    canLoad: [],
  },
  {
    path: ROUTER_UTILS.config.settings.root,
    loadChildren: async () =>
      (await import('@pages/settings/settings.module')).SettingsModule,
    canLoad: [],
  },
  {
    path: ROUTER_UTILS.config.member.root,
    loadChildren: async () =>
      (await import('@pages/member/member.module')).MemberModule,
    canLoad: [],
  },
  {
    path: ROUTER_UTILS.config.space.root,
    loadChildren: async () =>
      (await import('@pages/space/space.module')).SpaceModule,
    canLoad: [],
  },
  {
    path: '**',
    loadChildren: async () =>
      (await import('@shell/ui/not-found/not-found.module')).NotFoundModule,
    component: NotFoundPage,
  },
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forRoot(APP_ROUTES),
    FooterModule,
    HeaderModule,
    LayoutModule,
    NotFoundModule,
  ],
  exports: [
    RouterModule,
    FooterModule,
    HeaderModule,
    LayoutModule,
    NotFoundModule,
  ]
})
export class WebShellModule { }
