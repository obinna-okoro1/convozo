import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-success',
  imports: [CommonModule],
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.css']
})
export class SuccessComponent implements OnInit {
  protected readonly isCallBooking = signal(false);

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const type = this.route.snapshot.queryParamMap.get('type');
    this.isCallBooking.set(type === 'call');
  }

  goHome() {
    this.router.navigate(['/home']);
  }
}
