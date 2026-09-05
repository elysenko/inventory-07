import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard, managerGuard } from './core/manager.guard';

export const routes: Routes = [
  {
    path: 'login',
    data: { flow: 'auth-login', chrome: false },
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    data: { flow: 'auth-signup', chrome: false },
    loadComponent: () =>
      import('./features/auth/signup.component').then((m) => m.SignupComponent),
  },

  {
    path: 'items',
    canActivate: [authGuard],
    data: { flow: 'items-list' },
    loadComponent: () =>
      import('./features/items/item-list.component').then((m) => m.ItemListComponent),
  },
  {
    path: 'items/new',
    canActivate: [authGuard, managerGuard],
    data: { flow: 'items-create' },
    loadComponent: () =>
      import('./features/items/item-form.component').then((m) => m.ItemFormComponent),
  },
  {
    path: 'items/:id/edit',
    canActivate: [authGuard, managerGuard],
    data: { flow: 'items-edit' },
    loadComponent: () =>
      import('./features/items/item-form.component').then((m) => m.ItemFormComponent),
  },
  {
    path: 'items/:id',
    canActivate: [authGuard],
    data: { flow: 'items-detail' },
    loadComponent: () =>
      import('./features/items/item-detail.component').then((m) => m.ItemDetailComponent),
  },

  {
    path: 'locations',
    canActivate: [authGuard],
    data: { flow: 'locations-list' },
    loadComponent: () =>
      import('./features/locations/location-list.component').then(
        (m) => m.LocationListComponent,
      ),
  },
  {
    path: 'locations/new',
    canActivate: [authGuard, managerGuard],
    data: { flow: 'locations-create' },
    loadComponent: () =>
      import('./features/locations/location-form.component').then(
        (m) => m.LocationFormComponent,
      ),
  },
  {
    path: 'locations/:id/edit',
    canActivate: [authGuard, managerGuard],
    data: { flow: 'locations-edit' },
    loadComponent: () =>
      import('./features/locations/location-form.component').then(
        (m) => m.LocationFormComponent,
      ),
  },

  {
    path: 'movements/new',
    canActivate: [authGuard],
    data: { flow: 'movements-create' },
    loadComponent: () =>
      import('./features/movements/movement-new.component').then(
        (m) => m.MovementNewComponent,
      ),
  },
  {
    path: 'movements',
    canActivate: [authGuard, managerGuard],
    data: { flow: 'movements-log' },
    loadComponent: () =>
      import('./features/movements/movement-log.component').then(
        (m) => m.MovementLogComponent,
      ),
  },

  {
    path: 'reports/low-stock',
    canActivate: [authGuard, managerGuard],
    data: { flow: 'reports-low-stock' },
    loadComponent: () =>
      import('./features/reports/low-stock.component').then((m) => m.LowStockComponent),
  },

  {
    path: 'admin/settings',
    canActivate: [authGuard, adminGuard],
    data: { flow: 'admin-settings' },
    loadComponent: () =>
      import('./features/admin/settings.component').then((m) => m.SettingsComponent),
  },

  { path: '', pathMatch: 'full', redirectTo: 'items' },
  { path: '**', redirectTo: 'items' },
];
