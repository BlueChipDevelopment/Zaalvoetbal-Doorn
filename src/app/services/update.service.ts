import { Injectable, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UpdateService implements OnDestroy {
  private updateCheckInProgress = false;
  private updateCheckInterval?: number;
  private visibilityChangeHandler?: () => void;
  private onlineHandler?: () => void;

  constructor(
    private swUpdate: SwUpdate,
    private snackBar: MatSnackBar
  ) {}

  public initializeUpdateService(): void {
    if (!this.swUpdate.isEnabled) {
      console.log('Service Worker not enabled');
      return;
    }

    console.log('Initializing Angular Service Worker update service...');

    // Check for updates immediately
    this.checkForUpdates();

    // Listen for new versions
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe((evt) => {
        console.log('New version available:', evt.latestVersion.hash);
        this.promptUser();
      });

    // Smart update checking - network and visibility aware
    this.setupSmartUpdateChecking();
  }

  private setupSmartUpdateChecking(): void {
    // Clear any existing interval to prevent duplicates
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    // Check for updates every hour, but only when conditions are favorable
    this.updateCheckInterval = window.setInterval(() => {
      this.smartCheckForUpdates();
    }, 3600000); // 1 hour = 3600000 milliseconds

    // Remove existing listeners to prevent duplicates
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }

    // Also check when page becomes visible (user returns to app)
    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('App became visible, checking for updates...');
        setTimeout(() => this.smartCheckForUpdates(), 2000); // Small delay to avoid blocking UI
      }
    };
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    // Check when coming back online
    this.onlineHandler = () => {
      console.log('Network connection restored, checking for updates...');
      setTimeout(() => this.smartCheckForUpdates(), 1000);
    };
    window.addEventListener('online', this.onlineHandler);
  }

  private smartCheckForUpdates(): void {
    // Only check if online and app is visible
    if (!navigator.onLine) {
      console.log('Skipping update check - offline');
      return;
    }

    if (document.visibilityState !== 'visible') {
      console.log('Skipping update check - app not visible');
      return;
    }

    console.log('Smart update check - conditions favorable');
    this.checkForUpdates();
  }

  private checkForUpdates(): void {
    if (this.swUpdate.isEnabled && !this.updateCheckInProgress) {
      this.updateCheckInProgress = true;
      console.log('🔍 Starting update check...');
      
      this.swUpdate.checkForUpdate().then((hasUpdate) => {
        if (hasUpdate) {
          console.log('Update check: New version found');
        } else {
          console.log('Update check: No new version available');
        }
      }).catch((error) => {
        console.error('Error checking for updates:', error);
        this.handleUpdateError('Failed to check for updates', error);
      }).finally(() => {
        this.updateCheckInProgress = false;
        console.log('✅ Update check completed');
      });
    } else if (this.updateCheckInProgress) {
      console.log('⏳ Update check already in progress, skipping...');
    }
  }

  private promptUser(): void {
    let countdown = 5;
    let isActive = true;
    
    // Initial snackbar
    let snackBarRef = this.snackBar.open(
      `Nieuwe versie beschikbaar! Auto-update in ${countdown}s... 🚀`, 
      'Nu updaten',
      {
        duration: 0, // Blijft open tot gebruiker klikt
        verticalPosition: 'top',
        horizontalPosition: 'center'
      }
    );

    // Handle manual update
    snackBarRef.onAction().subscribe(() => {
      isActive = false;
      this.activateUpdate();
    });

    // Countdown timer with snackbar recreation
    const countdownInterval = setInterval(() => {
      countdown--;
      
      if (!isActive) {
        clearInterval(countdownInterval);
        return;
      }
      
      if (countdown > 0) {
        // Recreate snackbar with new countdown message
        snackBarRef.dismiss();
        snackBarRef = this.snackBar.open(
          `Nieuwe versie beschikbaar! Auto-update in ${countdown}s... 🚀`, 
          'Nu updaten',
          {
            duration: 0,
            verticalPosition: 'top',
            horizontalPosition: 'center'
          }
        );
        
        // Re-attach action handler
        snackBarRef.onAction().subscribe(() => {
          isActive = false;
          this.activateUpdate();
        });
      } else {
        // Time's up - auto update
        clearInterval(countdownInterval);
        if (isActive) {
          snackBarRef.dismiss();
          console.log('Auto-updating after countdown...');
          this.activateUpdate();
        }
      }
    }, 1000);

    // Clean up if dismissed manually
    snackBarRef.afterDismissed().subscribe(() => {
      if (isActive) {
        clearInterval(countdownInterval);
        isActive = false;
      }
    });
  }

  private activateUpdate(): void {
    if (this.swUpdate.isEnabled) {
      // Show loading state
      const loadingSnackBar = this.snackBar.open(
        'Update wordt geïnstalleerd...', 
        '', 
        {
          duration: 0,
          verticalPosition: 'top',
          horizontalPosition: 'center'
        }
      );

      this.swUpdate.activateUpdate().then(() => {
        console.log('Update activated, reloading...');
        loadingSnackBar.dismiss();
        
        // Brief success message before reload
        this.snackBar.open('Update succesvol! Pagina wordt vernieuwd...', '', {
          duration: 1500,
          verticalPosition: 'top',
          horizontalPosition: 'center'
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }).catch((error) => {
        console.error('Error activating update:', error);
        loadingSnackBar.dismiss();
        this.handleUpdateError('Failed to install update', error);
      });
    }
  }

  // Manual check method (can be called from UI)
  public checkForUpdatesManually(): void {
    if (!this.swUpdate.isEnabled) {
      this.snackBar.open('Updates niet beschikbaar in development mode', 'OK', {
        duration: 3000
      });
      return;
    }

    if (!navigator.onLine) {
      this.snackBar.open('Geen internetverbinding - probeer later opnieuw', 'OK', {
        duration: 4000
      });
      return;
    }

    // Show checking state
    const checkingSnackBar = this.snackBar.open(
      'Controleren op updates...', 
      '', 
      {
        duration: 0
      }
    );

    this.swUpdate.checkForUpdate().then((hasUpdate) => {
      checkingSnackBar.dismiss();
      
      if (hasUpdate) {
        this.promptUser();
      } else {
        this.snackBar.open('Je hebt al de nieuwste versie! 🎉', 'OK', {
          duration: 3000
        });
      }
    }).catch((error) => {
      checkingSnackBar.dismiss();
      console.error('Manual update check failed:', error);
      this.handleUpdateError('Failed to check for updates manually', error);
    });
  }

  private handleUpdateError(message: string, error: any): void {
    console.error(`Update error: ${message}`, error);
    
    // Show user-friendly error message
    let userMessage = 'Update check mislukt';
    
    if (!navigator.onLine) {
      userMessage = 'Geen internetverbinding voor updates';
    } else if (error.message?.includes('fetch')) {
      userMessage = 'Netwerkprobleem - probeer later opnieuw';
    } else if (error.message?.includes('timeout')) {
      userMessage = 'Update check duurde te lang';
    }
    
    this.snackBar.open(userMessage, 'OK', {
      duration: 5000,
      verticalPosition: 'top',
      horizontalPosition: 'center'
    });
  }

  // Test method to simulate update available (development only)
  public simulateUpdateAvailable(): void {
    if (!environment.production) {
      console.log('🧪 Simulating update available...');
      this.promptUser();
    }
  }

  // Test method to simulate update error (development only)
  public simulateUpdateError(): void {
    if (!environment.production) {
      console.log('🧪 Simulating update error...');
      this.handleUpdateError('Simulated error for testing', new Error('Test error'));
    }
  }

  ngOnDestroy(): void {
    // Clean up interval
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      console.log('🧹 Cleared update check interval');
    }

    // Clean up event listeners
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      console.log('🧹 Removed visibilitychange listener');
    }

    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      console.log('🧹 Removed online listener');
    }
  }
}