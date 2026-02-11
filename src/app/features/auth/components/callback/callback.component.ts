/**
 * Callback Component
 * Lean component that delegates auth logic to AuthService
 */

import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-callback',
  imports: [],
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.css']
})
export class CallbackComponent implements OnInit {
  constructor(private readonly authService: AuthService) {}

  public async ngOnInit(): Promise<void> {
    await this.authService.handleAuthCallback();
  }
}
