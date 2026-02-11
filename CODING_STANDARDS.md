# Coding Standards

This document outlines the mandatory coding standards for the Convozo project. All developers must follow these guidelines to maintain code quality, consistency, and maintainability.

---

## 1. Template Separation (MANDATORY)

### Rule: All templates must be in separate HTML files

**❌ NEVER DO THIS:**
```typescript
@Component({
  selector: 'app-example',
  template: `
    <div>Inline template</div>
  `
})
export class ExampleComponent {}
```

**✅ ALWAYS DO THIS:**
```typescript
@Component({
  selector: 'app-example',
  templateUrl: './example.component.html',
  styleUrls: ['./example.component.css']
})
export class ExampleComponent {}
```

### Why?
- **Separation of concerns**: Keep HTML, CSS, and TypeScript separate
- **Better tooling**: Full IDE support for HTML and CSS
- **Easier maintenance**: Locate and update templates quickly
- **Team collaboration**: Frontend developers can work on templates independently
- **Code readability**: Components remain focused on logic, not presentation

### File Structure
```
component-name/
├── component-name.component.ts     # Component logic
├── component-name.component.html   # Template (REQUIRED)
├── component-name.component.css    # Styles (REQUIRED)
└── component-name.component.spec.ts # Tests (if applicable)
```

---

## 2. Lean Components (MANDATORY)

### Rule: Components should only contain presentation logic

Components are responsible for:
- ✅ Managing UI state (signals, form controls)
- ✅ Handling user interactions (clicks, inputs)
- ✅ Binding data to templates
- ✅ Delegating business logic to services

Components should NOT contain:
- ❌ Business logic (calculations, validations, algorithms)
- ❌ Data access logic (API calls, database queries)
- ❌ Complex transformations
- ❌ Reusable utility functions

### Example

**❌ BAD - Component with business logic:**
```typescript
export class DashboardComponent {
  async loadData() {
    // Direct database calls in component
    const { data } = await this.supabase
      .from('messages')
      .select('*')
      .eq('creator_id', this.creatorId);
    
    // Business logic in component
    const total = data.reduce((sum, msg) => sum + msg.amount, 0);
    this.revenue.set(total);
  }
}
```

**✅ GOOD - Lean component using services:**
```typescript
export class DashboardComponent {
  constructor(private messageService: MessageService) {}
  
  async loadData() {
    // Delegate to service
    const messages = await this.messageService.getMessages(this.creatorId);
    const stats = this.messageService.calculateStats(messages);
    this.stats.set(stats);
  }
}
```

---

## 3. Service-Based Architecture (MANDATORY)

### Rule: Business logic belongs in services

### Service Responsibilities
Services handle:
- ✅ Business logic and calculations
- ✅ Data access and API calls
- ✅ Data transformations
- ✅ Validation logic
- ✅ State management (when needed)

### Service Structure

**Feature Services:**
```
features/
├── auth/
│   └── services/
│       └── auth.service.ts          # Auth-specific business logic
├── creator/
│   └── services/
│       └── creator.service.ts       # Creator-specific business logic
└── messages/
    └── services/
        └── message.service.ts       # Message-specific business logic
```

**Core Services:**
```
core/
└── services/
    ├── supabase.service.ts          # Data access layer
    ├── stripe.service.ts            # Payment logic
    └── notification.service.ts      # Notification logic
```

### Service Example

```typescript
@Injectable({
  providedIn: 'root'
})
export class CreatorService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Get messages for a creator (data access)
   */
  async getMessages(creatorId: string): Promise<Message[]> {
    const { data } = await this.supabase.client
      .from('messages')
      .select('*')
      .eq('creator_id', creatorId);
    return data || [];
  }

  /**
   * Calculate statistics (business logic)
   */
  calculateStats(messages: Message[]): Stats {
    return {
      total: messages.length,
      unhandled: messages.filter(m => !m.handled).length,
      revenue: messages.reduce((sum, m) => sum + m.amount, 0)
    };
  }

  /**
   * Reply to message (complex operation)
   */
  async replyToMessage(messageId: string, content: string): Promise<void> {
    // Business logic: update database
    await this.supabase.client
      .from('messages')
      .update({ reply: content, handled: true })
      .eq('id', messageId);
    
    // Business logic: send notification
    await this.sendEmail(messageId, content);
  }
}
```

---

## 4. Access Modifiers (MANDATORY)

### Rule: All properties and methods MUST have explicit access modifiers

**❌ NEVER:**
```typescript
email = signal('');           // Missing access modifier
async loadData() { }          // Missing access modifier
```

**✅ ALWAYS:**
```typescript
protected readonly email = signal<string>('');
private async loadData(): Promise<void> { }
```

### Access Modifier Guidelines

- `public` - Used by template or external components
- `protected` - Used by template only (preferred for template bindings)
- `private` - Internal implementation, not used in template

```typescript
export class ExampleComponent {
  // Public: Exposed API (rare in components)
  public readonly somePublicApi: string = '';

  // Protected: Used in template
  protected readonly displayName = signal<string>('');
  protected handleClick(): void { }

  // Private: Internal helpers
  private readonly userId = signal<string>('');
  private loadData(): Promise<void> { }
  private calculateTotal(): number { }
}
```

---

## 5. Type Safety (MANDATORY)

### Rule: NO implicit `any` types

**❌ NEVER:**
```typescript
protected data;                    // Implicit any
protected async fetchData() { }    // Implicit any return
```

**✅ ALWAYS:**
```typescript
protected readonly data = signal<UserData | null>(null);
protected async fetchData(): Promise<UserData> { }
```

### Type Guidelines

- Use interfaces/types from `core/models`
- Define return types for all methods
- Use generics for reusable code
- Avoid `any` - use `unknown` if type is truly unknown

```typescript
// Define interfaces in core/models
export interface Message {
  id: string;
  content: string;
  sender_email: string;
  created_at: string;
}

// Use typed signals
protected readonly messages = signal<Message[]>([]);
protected readonly loading = signal<boolean>(false);

// Use typed method returns
protected async loadMessages(): Promise<Message[]> {
  const { data } = await this.service.getMessages();
  return data || [];
}
```

---

## 6. File Organization

### Project Structure

```
src/app/
├── core/                         # Singleton services, models, constants
│   ├── guards/                   # Route guards
│   ├── interceptors/             # HTTP interceptors
│   ├── services/                 # Core singleton services
│   ├── models/                   # TypeScript interfaces/types
│   ├── constants/                # App-wide constants
│   └── validators/               # Validation utilities
│
├── features/                     # Feature modules
│   ├── auth/
│   │   ├── components/           # Auth components
│   │   ├── services/             # Auth business logic
│   │   └── auth.routes.ts        # Auth routes
│   ├── creator/
│   │   ├── components/           # Creator components
│   │   ├── services/             # Creator business logic
│   │   └── creator.routes.ts     # Creator routes
│   └── public/
│       ├── components/           # Public components
│       └── public.routes.ts      # Public routes
│
└── shared/                       # Reusable components/utilities
    ├── components/               # Shared UI components
    ├── directives/               # Shared directives
    ├── pipes/                    # Shared pipes
    └── utils/                    # Utility functions
```

---

## 7. Component Naming Conventions

### Component Files
- Component: `component-name.component.ts`
- Template: `component-name.component.html`
- Styles: `component-name.component.css`
- Tests: `component-name.component.spec.ts`

### Component Classes
```typescript
// PascalCase + Component suffix
export class DashboardComponent { }
export class MessageListComponent { }
export class UserProfileComponent { }
```

### Selectors
```typescript
// kebab-case with app prefix
selector: 'app-dashboard'
selector: 'app-message-list'
selector: 'app-user-profile'
```

---

## 8. Service Naming Conventions

### Service Files
- Service: `feature-name.service.ts`
- Tests: `feature-name.service.spec.ts`

### Service Classes
```typescript
// PascalCase + Service suffix
export class AuthService { }
export class CreatorService { }
export class MessageService { }
```

### Service Registration
```typescript
@Injectable({
  providedIn: 'root'  // Preferred for tree-shaking
})
export class ExampleService { }
```

---

## 9. Code Quality Checklist

Before committing code, ensure:

### Templates
- [ ] All templates in separate `.html` files
- [ ] No inline templates in `.ts` files
- [ ] All styles in separate `.css` files
- [ ] No inline styles in `.ts` files

### Components
- [ ] Components are lean (< 200 lines)
- [ ] Business logic delegated to services
- [ ] Only presentation logic in components
- [ ] All template bindings use `protected` access

### Services
- [ ] Business logic in services, not components
- [ ] Data access through services
- [ ] Reusable logic in services
- [ ] `@Injectable({ providedIn: 'root' })`

### TypeScript
- [ ] All properties have access modifiers
- [ ] All methods have access modifiers
- [ ] All methods have return types
- [ ] No `any` types (use proper interfaces)
- [ ] Signals typed: `signal<Type>(initialValue)`

### Documentation
- [ ] Public methods have JSDoc comments
- [ ] Complex logic has explanatory comments
- [ ] File has header comment explaining purpose

---

## 10. Examples

### Complete Component Example

**login.component.ts**
```typescript
/**
 * Login Component
 * Handles user authentication via magic link
 */

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  // Template bindings
  protected readonly email = signal<string>('');
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);

  constructor(private readonly authService: AuthService) {}

  /**
   * Handle login form submission
   */
  protected async handleLogin(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.authService.sendMagicLink(this.email());

    if (!result.success) {
      this.error.set(result.error || 'Login failed');
    }

    this.loading.set(false);
  }

  /**
   * Update email value
   */
  protected updateEmail(value: string): void {
    this.email.set(value);
    this.error.set(null);
  }
}
```

**login.component.html**
```html
<div class="login-container">
  <h1>Sign In</h1>
  
  <form (ngSubmit)="handleLogin()">
    <input 
      type="email" 
      [value]="email()"
      (input)="updateEmail($any($event.target).value)"
      placeholder="Enter your email"
    />
    
    @if (error()) {
      <div class="error">{{ error() }}</div>
    }
    
    <button type="submit" [disabled]="loading()">
      {{ loading() ? 'Sending...' : 'Send Magic Link' }}
    </button>
  </form>
</div>
```

### Complete Service Example

**auth.service.ts**
```typescript
/**
 * Auth Service
 * Handles all authentication business logic
 */

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router
  ) {}

  /**
   * Send magic link to user's email
   */
  public async sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return { success: false, error: message };
    }
  }

  /**
   * Get current authenticated user
   */
  public getCurrentUser() {
    return this.supabase.getCurrentUser();
  }

  /**
   * Sign out current user
   */
  public async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
    await this.router.navigate(['/auth/login']);
  }
}
```

---

## 11. Enforcement

These standards are **MANDATORY**. Code reviews will reject pull requests that:

1. Use inline templates instead of separate HTML files
2. Have business logic in components
3. Missing access modifiers on properties/methods
4. Use `any` type without justification
5. Have bloated components (> 200 lines of logic)

---

## 12. Benefits

Following these standards provides:

✅ **Maintainability** - Clear separation makes code easy to understand and modify
✅ **Scalability** - Modular architecture supports growth
✅ **Testability** - Services can be tested independently
✅ **Team Collaboration** - Clear boundaries enable parallel development
✅ **Code Quality** - Consistent patterns across the codebase
✅ **Developer Experience** - Better IDE support and tooling

---

## Questions?

If you have questions about these standards, please:
1. Review the examples in this document
2. Check existing code that follows these patterns
3. Ask in team discussions

**Remember: These are not suggestions - they are requirements.**
