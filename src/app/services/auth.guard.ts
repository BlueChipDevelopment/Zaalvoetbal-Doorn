import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> | boolean {
    // Check if user is authenticated
    if (this.authService.getAuthState()) {
      return true;
    }
    
    // If not authenticated, redirect to pincode page
    this.router.navigate(['/pincode']);
    return false;
  }
}
