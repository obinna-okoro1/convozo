/**
 * Unit tests for ToastContainerComponent
 * Verifies that the component renders toast items driven by ToastService,
 * and that CSS class helpers return the correct Tailwind class strings.
 */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService, Toast } from '../../services/toast.service';

// Private-method accessor interface used to call protected helpers in tests
interface ToastContainerInternal {
  getToastClasses(t: Toast): string;
  getIconBgClasses(t: Toast): string;
}

const makeToast = (type: Toast['type']): Toast => ({
  id: 1,
  message: 'Test',
  type,
  duration: 3000,
});

describe('ToastContainerComponent', () => {
  let fixture: ComponentFixture<ToastContainerComponent>;
  let component: ToastContainerComponent;
  let toastService: ToastService;
  // Typed view of protected helpers for white-box tests
  let internal: ToastContainerInternal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainerComponent);
    component = fixture.componentInstance;
    internal = component as unknown as ToastContainerInternal;
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Toast list rendering ───────────────────────────────────────────────────

  it('renders no toasts when the service list is empty', () => {
    expect(toastService.toasts().length).toBe(0);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-toast]').length).toBe(0);
  });

  // ── getToastClasses() ─────────────────────────────────────────────────────

  describe('getToastClasses()', () => {
    it('returns emerald classes for success toasts', () => {
      expect(internal.getToastClasses(makeToast('success'))).toContain('emerald');
    });

    it('returns red classes for error toasts', () => {
      expect(internal.getToastClasses(makeToast('error'))).toContain('red');
    });

    it('returns yellow classes for warning toasts', () => {
      expect(internal.getToastClasses(makeToast('warning'))).toContain('yellow');
    });

    it('returns blue classes for info toasts', () => {
      expect(internal.getToastClasses(makeToast('info'))).toContain('blue');
    });

    it('always includes the base "border" class', () => {
      (['success', 'error', 'warning', 'info'] as const).forEach((type) => {
        expect(internal.getToastClasses(makeToast(type))).toContain('border');
      });
    });
  });

  // ── getIconBgClasses() ────────────────────────────────────────────────────

  describe('getIconBgClasses()', () => {
    it('returns from-emerald gradient for success', () => {
      expect(internal.getIconBgClasses(makeToast('success'))).toContain('emerald');
    });

    it('returns from-red gradient for error', () => {
      expect(internal.getIconBgClasses(makeToast('error'))).toContain('red');
    });

    it('returns from-yellow gradient for warning', () => {
      expect(internal.getIconBgClasses(makeToast('warning'))).toContain('yellow');
    });

    it('returns from-blue gradient for info', () => {
      expect(internal.getIconBgClasses(makeToast('info'))).toContain('blue');
    });
  });

  // ── dismiss via service ───────────────────────────────────────────────────

  it('removing a toast via ToastService updates the signal', () => {
    toastService.success('Dismissable', 0); // duration=0 prevents auto-dismiss
    expect(toastService.toasts().length).toBe(1);

    const id = toastService.toasts()[0].id;
    toastService.dismiss(id);

    expect(toastService.toasts().length).toBe(0);
  });
});

