import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './auth.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  readonly submitted = signal(false);

  /**
   * Preview-only affordance. The label lives in TypeScript behind the
   * build-time constant so it is stripped from the production bundle along
   * with the shortcut itself.
   */
  readonly previewShortcut = COLOSSUS_PREVIEW ? 'Skip login — Demo Mode' : '';
  readonly previewMode = COLOSSUS_PREVIEW;

  /** Ships empty — no seeded credentials anywhere. */
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? undefined;
    await this.auth.login(email, password, returnUrl);
  }

  skipLogin(): void {
    this.auth.previewSignIn('ADMIN');
  }
}
