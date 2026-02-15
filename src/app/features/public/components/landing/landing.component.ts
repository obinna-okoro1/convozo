import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing',
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent {
  constructor(private router: Router) {}

  navigateToSignup() {
    this.router.navigate(['/auth/signup']);
  }

  navigateToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
