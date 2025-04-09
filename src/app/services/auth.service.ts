import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authenticated = new BehaviorSubject<boolean>(false);

  constructor(private router: Router) {
    // Check if user was previously authenticated in this session
    this.authenticated.next(sessionStorage.getItem('authenticated') === 'true');
  }

  /**
   * Validates the provided PIN code against the stored PIN
   * @param pin The PIN code entered by the user
   * @returns Boolean indicating if authentication was successful
   */
  validatePin(pin: string): boolean {
    const isValid = pin === environment.pinCode;
    
    if (isValid) {
      // Store authentication state in session storage
      sessionStorage.setItem('authenticated', 'true');
      this.authenticated.next(true);
      this.router.navigate(['/']); // Navigate to home page after successful login
    }
    
    return isValid;
  }

  /**
   * Check if user is currently authenticated
   * @returns Observable of authentication state
   */
  isAuthenticated(): Observable<boolean> {
    return this.authenticated.asObservable();
  }

  /**
   * Returns the current authentication state as a boolean
   * @returns Current authentication state
   */
  getAuthState(): boolean {
    return this.authenticated.value;
  }

  /**
   * Logs the user out by clearing the authentication state
   */
  logout(): void {
    sessionStorage.removeItem('authenticated');
    this.authenticated.next(false);
    this.router.navigate(['/pincode']);
  }
}
