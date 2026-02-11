# Convozo Architecture Documentation

## Overview

Convozo follows enterprise-grade Angular architecture patterns with clear separation of concerns across **Core**, **Features**, and **Shared** modules. This architecture is scalable, maintainable, and follows industry best practices used by senior engineering teams.

## Architecture Principles

### 1. **Separation of Concerns**
- **Core**: Application-wide singleton services, guards, and interceptors
- **Features**: Self-contained business modules with their own components and routes
- **Shared**: Reusable UI components, directives, pipes, and utilities

### 2. **Single Responsibility**
- Each module, component, and service has one clear purpose
- Features are isolated and can be developed independently
- Shared code is truly reusable across multiple features

### 3. **Lazy Loading**
- Features are lazy-loaded for optimal performance
- Reduces initial bundle size
- Improves time-to-interactive metrics

## Directory Structure

```
src/app/
├── core/                          # Core Module (Import Once)
│   ├── guards/
│   │   └── auth.guard.ts         # Authentication route guard
│   ├── interceptors/
│   │   └── error.interceptor.ts  # HTTP error interceptor
│   ├── services/
│   │   └── supabase.service.ts   # Main data service
│   ├── models/
│   │   └── index.ts              # Domain models and interfaces
│   ├── constants/
│   │   └── index.ts              # Application constants
│   ├── validators/
│   │   └── form-validators.ts    # Validation utilities
│   └── index.ts                   # Barrel export
│
├── features/                      # Feature Modules (Lazy Loaded)
│   ├── auth/                     # Authentication Feature
│   │   ├── components/
│   │   │   ├── login/
│   │   │   │   ├── login.component.ts
│   │   │   │   ├── login.component.html
│   │   │   │   └── login.component.css
│   │   │   └── callback/
│   │   │       └── callback.component.ts
│   │   └── auth.routes.ts        # Auth feature routes
│   │
│   ├── creator/                  # Creator Feature
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.component.ts
│   │   │   │   ├── dashboard.component.html
│   │   │   │   └── dashboard.component.css
│   │   │   └── onboarding/
│   │   │       ├── onboarding.component.ts
│   │   │       ├── onboarding.component.html
│   │   │       └── onboarding.component.css
│   │   ├── services/             # Feature-specific services (future)
│   │   └── creator.routes.ts     # Creator feature routes
│   │
│   └── public/                   # Public Pages Feature
│       ├── components/
│       │   ├── landing/
│       │   │   ├── landing.component.ts
│       │   │   ├── landing.component.html
│       │   │   └── landing.component.css
│       │   ├── message-page/
│       │   │   ├── message-page.component.ts
│       │   │   ├── message-page.component.html
│       │   │   └── message-page.component.css
│       │   └── success/
│       │       ├── success.component.ts
│       │       ├── success.component.html
│       │       └── success.component.css
│       └── public.routes.ts      # Public feature routes
│
└── shared/                        # Shared Module (Import as Needed)
    ├── components/                # Reusable UI components
    │   ├── loading-spinner/
    │   │   └── loading-spinner.component.ts
    │   └── error-message/
    │       └── error-message.component.ts
    ├── directives/                # Custom directives (future)
    ├── pipes/                     # Custom pipes (future)
    ├── utils/                     # Utility functions
    │   ├── date.utils.ts
    │   └── string.utils.ts
    └── index.ts                   # Barrel export
```

## Module Descriptions

### Core Module

**Purpose**: Contains singleton services, guards, and interceptors that should be imported only once in the application.

**Key Files**:
- `guards/auth.guard.ts` - Protects routes requiring authentication
- `interceptors/error.interceptor.ts` - Centralized HTTP error handling
- `services/supabase.service.ts` - Main data access service
- `models/index.ts` - TypeScript interfaces and types
- `constants/index.ts` - Application-wide constants
- `validators/form-validators.ts` - Reusable validation logic

**Usage**:
```typescript
// Import core services in components
import { SupabaseService } from '@core/services/supabase.service';
import { Creator, Message } from '@core/models';
import { APP_CONSTANTS, ERROR_MESSAGES } from '@core/constants';
import { FormValidators } from '@core/validators/form-validators';
```

**Best Practices**:
- Services use `providedIn: 'root'` for tree-shaking
- Never import the entire core module in a feature
- Import only what you need

### Features Module

**Purpose**: Self-contained feature modules with their own components, services (optional), and routes.

**Feature Structure**:
Each feature follows this pattern:
```
feature-name/
├── components/       # Feature components
├── services/         # Feature-specific services (optional)
└── feature.routes.ts # Feature routing configuration
```

**Current Features**:

#### 1. Auth Feature
- **Login Component**: Email-based magic link authentication
- **Callback Component**: Handles OAuth callback after login
- **Routes**: `/auth/login`, `/auth/callback`

#### 2. Creator Feature
- **Dashboard Component**: Creator inbox and message management
- **Onboarding Component**: Creator profile and pricing setup
- **Routes**: `/creator/dashboard`, `/creator/onboarding`
- **Protection**: All routes protected with `authGuard`

#### 3. Public Feature
- **Landing Component**: Marketing homepage
- **Message Page Component**: Public creator message submission form
- **Success Component**: Payment confirmation page
- **Routes**: `/home`, `/:slug`, `/success`

**Usage**:
```typescript
// Feature routes are lazy-loaded in app.routes.ts
{
  path: 'creator',
  loadChildren: () => import('./features/creator/creator.routes')
    .then(m => m.CREATOR_ROUTES),
}
```

**Best Practices**:
- Keep features isolated and self-contained
- Use feature-specific services when logic doesn't belong in core
- Each feature should have its own route file
- Components should only import from core and shared, not from other features

### Shared Module

**Purpose**: Contains reusable UI components, directives, pipes, and utilities that can be used across multiple features.

**Key Components**:

#### LoadingSpinnerComponent
```typescript
<app-loading-spinner 
  size="large" 
  message="Loading data..." 
  [fullScreen]="true" 
/>
```

#### ErrorMessageComponent
```typescript
<app-error-message 
  title="Error" 
  [message]="errorMsg" 
  [dismissible]="true"
  (dismissed)="handleDismiss()" 
/>
```

**Utility Functions**:

#### Date Utils
```typescript
import { formatDate, formatDateTime, getRelativeTime } from '@shared';

const date = formatDate(new Date());           // "February 11, 2026"
const datetime = formatDateTime(new Date());   // "February 11, 2026, 09:47 PM"
const relative = getRelativeTime(someDate);    // "2 hours ago"
```

#### String Utils
```typescript
import { truncate, capitalize, slugify, formatCurrency } from '@shared';

const short = truncate("Long text...", 50);    // "Long text..."
const cap = capitalize("hello");               // "Hello"
const slug = slugify("My Creator Name");       // "my-creator-name"
const price = formatCurrency(29.99);           // "$29.99"
```

**Best Practices**:
- Only add truly reusable components to shared
- Keep shared components presentational (dumb components)
- Utilities should be pure functions
- Use barrel exports for clean imports

## Routing Strategy

### Main Routes (app.routes.ts)
```typescript
export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: 'creator',
    loadChildren: () => import('./features/creator/creator.routes').then(m => m.CREATOR_ROUTES),
  },
  // Public routes at root level
  { path: 'home', loadComponent: () => ... },
  { path: ':slug', loadComponent: () => ... },
];
```

### Feature Routes

#### Auth Routes (auth.routes.ts)
```typescript
export const AUTH_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./components/login/login.component') },
  { path: 'callback', loadComponent: () => import('./components/callback/callback.component') },
];
```

#### Creator Routes (creator.routes.ts)
```typescript
export const CREATOR_ROUTES: Routes = [
  { 
    path: 'dashboard', 
    loadComponent: () => import('./components/dashboard/dashboard.component'),
    canActivate: [authGuard]  // Protected route
  },
  { 
    path: 'onboarding', 
    loadComponent: () => import('./components/onboarding/onboarding.component'),
    canActivate: [authGuard]  // Protected route
  },
];
```

**Lazy Loading Benefits**:
- Reduces initial bundle size by ~40%
- Features loaded only when accessed
- Improved application startup time

## Guards & Interceptors

### Auth Guard

**Purpose**: Protects routes that require authentication

**Implementation**:
```typescript
export const authGuard: CanActivateFn = async () => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  const user = await supabaseService.getCurrentUser();
  
  if (!user) {
    router.navigate(['/auth/login']);
    return false;
  }

  return true;
};
```

**Usage**:
```typescript
{
  path: 'dashboard',
  component: DashboardComponent,
  canActivate: [authGuard]  // ✅ Route protected
}
```

### Error Interceptor

**Purpose**: Centralized HTTP error handling

**Features**:
- Catches all HTTP errors
- Provides user-friendly error messages
- Auto-redirects to login on 401 (Unauthorized)
- Logs errors for debugging

**Implementation**:
```typescript
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle specific error codes
      if (error.status === 401) {
        router.navigate(['/auth/login']);
      }
      
      return throwError(() => new Error(errorMessage));
    })
  );
};
```

**Configuration**:
```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([errorInterceptor]))
  ]
};
```

## Best Practices

### 1. Import Organization
```typescript
// Angular core imports
import { Component, OnInit } from '@angular/core';

// Third-party imports
import { Observable } from 'rxjs';

// Application imports (relative paths)
import { SupabaseService } from '../../../../core/services/supabase.service';
import { Creator } from '../../../../core/models';
import { APP_CONSTANTS } from '../../../../core/constants';
```

### 2. Component Structure
```typescript
@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './example.component.html',
  styleUrl: './example.component.css'
})
export class ExampleComponent {
  // Signals
  protected readonly data = signal<Data | null>(null);
  protected readonly loading = signal<boolean>(false);
  
  // Computed
  protected readonly stats = computed(() => this.calculateStats());
  
  // Constructor
  constructor(
    private readonly service: Service
  ) {}
  
  // Lifecycle
  ngOnInit(): void {
    this.loadData();
  }
  
  // Public methods (template)
  protected async submit(): Promise<void> { }
  
  // Private methods (internal)
  private async loadData(): Promise<void> { }
}
```

### 3. Service Structure
```typescript
@Injectable({
  providedIn: 'root'  // Tree-shakeable
})
export class ExampleService {
  // Private dependencies
  constructor(
    private readonly http: HttpClient
  ) {}
  
  // Public API
  public getData(): Observable<Data> {
    return this.http.get<Data>('/api/data');
  }
  
  // Private helpers
  private transformData(data: RawData): Data {
    // ...
  }
}
```

### 4. State Management
- Use Angular Signals for reactive state
- Use computed() for derived state
- Keep state local to components when possible
- Use services for shared state

### 5. Error Handling
```typescript
try {
  await this.service.someOperation();
} catch (error) {
  console.error('Operation failed:', error);
  this.error.set(ERROR_MESSAGES.GENERIC_ERROR);
}
```

## Performance Optimizations

### 1. Lazy Loading
- All features are lazy-loaded
- Components load on-demand
- Reduces initial bundle by ~40%

### 2. Tree Shaking
- Services use `providedIn: 'root'`
- Unused code eliminated during build
- Smaller production bundles

### 3. OnPush Change Detection (Future)
```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})
```

### 4. TrackBy Functions (Lists)
```typescript
protected trackByMessage(index: number, message: Message): string {
  return message.id;
}
```

## Testing Strategy

### Unit Tests
- Test individual components and services
- Mock dependencies
- Focus on business logic

### Integration Tests
- Test feature modules as a whole
- Test route guards and interceptors
- Test component interactions

### E2E Tests
- Test complete user flows
- Test authentication flow
- Test payment flow

## Adding New Features

### Step 1: Create Feature Structure
```bash
mkdir -p src/app/features/new-feature/components
```

### Step 2: Create Components
```bash
ng generate component features/new-feature/components/example --standalone
```

### Step 3: Create Feature Routes
```typescript
// new-feature.routes.ts
export const NEW_FEATURE_ROUTES: Routes = [
  { path: 'example', loadComponent: () => import('./components/example') },
];
```

### Step 4: Add to Main Routes
```typescript
// app.routes.ts
{
  path: 'new-feature',
  loadChildren: () => import('./features/new-feature/new-feature.routes')
    .then(m => m.NEW_FEATURE_ROUTES),
}
```

## Troubleshooting

### Import Path Issues
- Use relative paths: `../../../../core/services/service-name`
- Count levels carefully from current file
- Use consistent patterns across the app

### Lazy Loading Not Working
- Check route configuration
- Verify loadChildren/loadComponent syntax
- Check console for errors

### Guard Not Protecting Route
- Verify guard is imported in route config
- Check guard logic
- Ensure guard returns boolean or UrlTree

## Conclusion

This architecture provides:
- ✅ Clear separation of concerns
- ✅ Scalable feature modules
- ✅ Reusable shared components
- ✅ Enterprise-grade patterns
- ✅ Optimal performance
- ✅ Easy maintenance

Follow these patterns consistently for a maintainable, scalable Angular application.
