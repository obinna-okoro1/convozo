import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { SupabaseService } from './core/services/supabase.service';

describe('App (root component)', () => {
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;

  beforeEach(async () => {
    supabaseSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['waitForSession']);
    supabaseSpy.waitForSession.and.resolveTo(null);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseSpy },
      ],
    }).compileComponents();
  });

  it('should create the root component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should call waitForSession on init', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(supabaseSpy.waitForSession).toHaveBeenCalledTimes(1);
  });

  it('should render router-outlet in the template', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
