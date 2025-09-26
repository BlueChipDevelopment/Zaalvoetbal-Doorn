import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-pwa-install-guide',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './pwa-install-guide.component.html',
  styleUrls: ['./pwa-install-guide.component.scss']
})
export class PwaInstallGuideComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() installed = new EventEmitter<void>();

  platform: 'ios' | 'android' | 'desktop' | 'unknown' = 'unknown';

  ngOnInit(): void {
    this.detectPlatform();
  }

  private detectPlatform(): void {
    const userAgent = navigator.userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(userAgent)) {
      this.platform = 'ios';
    } else if (/android/.test(userAgent)) {
      this.platform = 'android';
    } else if (/windows|macintosh|linux/.test(userAgent)) {
      this.platform = 'desktop';
    } else {
      this.platform = 'unknown';
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  markAsInstalled(): void {
    // Store that user has marked as installed
    localStorage.setItem('pwa-install-acknowledged', 'true');
    this.installed.emit();
    this.close.emit();
  }
}