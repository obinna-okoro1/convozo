import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './core/services/supabase.service';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent],
  template: `
    <router-outlet />
    <app-toast-container />
  `,
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = 'Convozo';

  constructor(private readonly supabaseService: SupabaseService) {}

  ngOnInit(): void {
    this.supabaseService.waitForSession();
  }
}
