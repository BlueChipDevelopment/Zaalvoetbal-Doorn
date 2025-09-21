import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { PwaInstallService } from './services/pwa-install.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Zaalvoetbal-Doorn';
  showInstallButton = false;
  isInstalled = false;

  constructor(
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private pwaInstallService: PwaInstallService
  ) {}

  ngOnInit() {
    // Listen for messages from the service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Received message from service worker:', event.data);
        
        if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
          this.handleInAppNotification(event.data);
        }
      });
    }

    // Setup PWA install functionality
    this.pwaInstallService.canInstall.subscribe(canInstall => {
      this.showInstallButton = canInstall && !this.isInstalled;
    });

    this.pwaInstallService.isInstalled.subscribe(installed => {
      this.isInstalled = installed;
      this.showInstallButton = !installed;
    });
  }

  ngOnDestroy() {
    // Clean up if needed
  }

  private handleInAppNotification(data: any) {
    console.log('🔔 Handling in-app notification:', data);
    
    // Create message for snackbar
    const message = `${data.title}: ${data.body}`;
    
    // Define action based on whether there's a URL
    const action = data.data?.url ? 'Bekijk' : 'OK';
    
    // Show elegant MatSnackBar notification
    const snackBarRef = this.snackBar.open(message, action, {
      duration: 8000, // 8 seconds auto-dismiss
      panelClass: ['futsal-notification', 'futsal-notification-info'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });

    // Handle action button click
    snackBarRef.onAction().subscribe(() => {
      console.log('🔗 User clicked snackbar action');
      
      // If there's a URL, navigate to it
      if (data.data?.url) {
        console.log('🔗 Navigating to:', data.data.url);
        window.open(data.data.url, '_blank');
      }
      
      console.log('✅ User acknowledged notification via SnackBar');
    });

    // Log when dismissed
    snackBarRef.afterDismissed().subscribe((info) => {
      if (info.dismissedByAction) {
        console.log('📤 SnackBar dismissed by action');
      } else {
        console.log('⏰ SnackBar auto-dismissed');
      }
    });
    
    console.log('✅ Elegant in-app notification displayed to user');
  }

  async installPWA() {
    if (this.pwaInstallService.isIOS) {
      this.showInstallInstructions();
    } else {
      const installed = await this.pwaInstallService.promptInstall();
      if (installed) {
        this.snackBar.open('App succesvol geïnstalleerd!', 'OK', { duration: 3000 });
      }
    }
  }

  private showInstallInstructions() {
    const instructions = this.pwaInstallService.getInstallInstructions();
    const message = `Installeer de app:\n${instructions.join('\n')}`;
    
    this.snackBar.open(message, 'Begrepen', {
      duration: 10000,
      panelClass: ['install-instructions'],
      verticalPosition: 'top'
    });
  }
}