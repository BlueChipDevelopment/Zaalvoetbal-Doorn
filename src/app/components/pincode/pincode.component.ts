import { Component, HostListener } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-pincode',
  templateUrl: './pincode.component.html',
  styleUrls: ['./pincode.component.css']
})
export class PincodeComponent {
  pinCode: string = '';
  pinLength: number = 4;
  error: boolean = false;
  keypadNumbers = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ['clear', 0, 'enter']
  ];

  constructor(private authService: AuthService) {}

  /**
   * Handle keypad button press
   * @param key The key value (number or special action)
   */
  handleKeyPress(key: number | string): void {
    if (typeof key === 'number') {
      this.addNumber(key);
    } else if (key === 'clear') {
      this.clearPin();
    } else if (key === 'enter') {
      this.submitPin();
    }
  }

  /**
   * Add a number to the current PIN code
   */
  addNumber(num: number): void {
    if (this.pinCode.length < this.pinLength) {
      this.pinCode += num;
      this.error = false;
    }
    
    // Auto-submit if PIN code is complete
    if (this.pinCode.length === this.pinLength) {
      setTimeout(() => this.submitPin(), 300);
    }
  }

  /**
   * Clear the current PIN code
   */
  clearPin(): void {
    this.pinCode = '';
    this.error = false;
  }

  /**
   * Clear the last digit of the PIN code
   */
  backspace(): void {
    this.pinCode = this.pinCode.slice(0, -1);
    this.error = false;
  }

  /**
   * Submit the PIN code for validation
   */
  submitPin(): void {
    if (this.pinCode.length === this.pinLength) {
      const isValid = this.authService.validatePin(this.pinCode);
      
      if (!isValid) {
        this.error = true;
        this.pinCode = '';
        // Vibrate on mobile devices for invalid PIN
        if ('vibrate' in navigator) {
          navigator.vibrate(200);
        }
      }
    }
  }

  /**
   * Handle keyboard input for desktop users
   */
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Allow numbers 0-9
    if (/^[0-9]$/.test(event.key)) {
      this.addNumber(parseInt(event.key, 10));
    } 
    // Allow backspace/delete to remove digits
    else if (event.key === 'Backspace' || event.key === 'Delete') {
      this.backspace();
    } 
    // Allow enter to submit
    else if (event.key === 'Enter') {
      this.submitPin();
    }
    // Allow escape to clear
    else if (event.key === 'Escape') {
      this.clearPin();
    }
  }

  /**
   * Generate an array for PIN code display dots
   */
  getPinDisplay(): number[] {
    return Array(this.pinLength).fill(0);
  }
}
