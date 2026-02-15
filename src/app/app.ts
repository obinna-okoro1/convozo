import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './core/services/supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = 'Convozo';

  constructor(private readonly supabaseService: SupabaseService) {}

  ngOnInit(): void {
    // Initialize session on app startup
    this.supabaseService.waitForSession();
  }
}
