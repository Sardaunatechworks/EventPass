// ============================================================
// EventPass: src/services/auth.service.js
// Authentication service using Supabase Auth
// ============================================================
import { supabase } from './supabase.js';
import { clearOrgContext } from '../utils/org-resolver.js';

export const AuthService = {
  /**
   * Sign in with email and password.
   */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Sign up a new user. Creates auth account only.
   * Organization creation is a separate step.
   */
  async signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata.fullName || '',
          ...metadata,
        },
      },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Resend signup verification email.
   */
  async resendVerification(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/app.html`,
      },
    });
    if (error) throw new Error(error.message);
  },

  /**
   * Sign out current user.
   */
  async signOut() {
    clearOrgContext();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  /**
   * Get current session.
   */
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    return session;
  },

  /**
   * Get currently authenticated user.
   */
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  },

  /**
   * Send password reset email.
   */
  async resetPassword(email) {
    // Verify email exists in the database first
    const { data: exists, error: checkError } = await supabase.rpc('check_email_exists', { p_email: email });
    if (checkError) {
      throw new Error('Error checking email. Please try again.');
    }
    if (!exists) {
      throw new Error('Email address not found.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`,
    });
    if (error) throw new Error(error.message);
  },

  /**
   * Update password (after reset).
   */
  async updatePassword(newPassword, metadata = {}) {
    const { error } = await supabase.auth.updateUser({ 
      password: newPassword,
      data: metadata
    });
    if (error) throw new Error(error.message);
  },

  /**
   * Listen to auth state changes.
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },

  /**
   * Check if user is authenticated.
   */
  async isAuthenticated() {
    const session = await this.getSession();
    return !!session;
  },
};

export default AuthService;
