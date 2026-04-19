
import { DBUser, DBAlert, DBTrade, SettingsState, SupportMessage } from '../models';

class ApiService {
  private static instance: ApiService;
  private baseUrl = '/api';
  private token: string | null = localStorage.getItem('se_auth_token');

  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('se_auth_token', token);
    } else {
      localStorage.removeItem('se_auth_token');
    }
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers as Record<string, string>,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Auth
  public async login(credentials: any): Promise<{ user: DBUser, token: string }> {
    const result = await this.request<{ user: DBUser, token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(result.token);
    return result;
  }

  public async register(data: any): Promise<{ user: DBUser, token: string }> {
    const result = await this.request<{ user: DBUser, token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(result.token);
    return result;
  }

  public async getMe(): Promise<DBUser> {
    return this.request<DBUser>('/auth/me');
  }

  public async getGoogleAuthUrl(): Promise<{ url: string }> {
    return this.request<{ url: string }>('/auth/google/url');
  }

  // User
  public async getUserByEmail(email: string): Promise<DBUser> {
    return this.request<DBUser>(`/users/${email}`);
  }

  // Alerts
  public async getAlerts(userId: string): Promise<DBAlert[]> {
    return this.request<DBAlert[]>(`/alerts/${userId}`);
  }

  public async createAlert(alert: Omit<DBAlert, 'id' | 'created_at' | 'is_active'>): Promise<DBAlert> {
    return this.request<DBAlert>('/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    });
  }

  public async deleteAlert(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/alerts/${id}`, {
      method: 'DELETE',
    });
  }

  // Trades
  public async getTrades(userId: string): Promise<DBTrade[]> {
    return this.request<DBTrade[]>(`/trades/${userId}`);
  }

  public async saveTrade(trade: Omit<DBTrade, 'id' | 'timestamp'>): Promise<DBTrade> {
    return this.request<DBTrade>('/trades', {
      method: 'POST',
      body: JSON.stringify(trade),
    });
  }

  // Positions
  public async getPositions(userId: string): Promise<any[]> {
    return this.request<any[]>(`/positions/${userId}`);
  }

  public async savePosition(position: any): Promise<any> {
    return this.request<any>('/positions', {
      method: 'POST',
      body: JSON.stringify(position),
    });
  }

  public async deletePosition(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/positions/${id}`, {
      method: 'DELETE',
    });
  }

  // Pending Orders
  public async getPendingOrders(userId: string): Promise<any[]> {
    return this.request<any[]>(`/pending-orders/${userId}`);
  }

  public async savePendingOrder(order: any): Promise<any> {
    return this.request<any>('/pending-orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  public async deletePendingOrder(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/pending-orders/${id}`, {
      method: 'DELETE',
    });
  }

  // Settings
  public async getSettings(userId: string): Promise<SettingsState | null> {
    const result = await this.request<{ settings: SettingsState } | null>(`/settings/${userId}`);
    return result ? result.settings : null;
  }

  public async saveSettings(userId: string, settings: SettingsState): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/settings', {
      method: 'POST',
      body: JSON.stringify({ userId, settings }),
    });
  }

  // Admin
  public async adminGetUsers(): Promise<DBUser[]> {
    return this.request<DBUser[]>('/admin/users');
  }

  public async adminUpdateUser(userId: string, tier: string, role: string, avatarTier?: string, premiumEndDate?: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/admin/update-user', {
      method: 'POST',
      body: JSON.stringify({ userId, tier, role, avatarTier, premiumEndDate }),
    });
  }

  // DB Status
  public async getDbStatus(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/db/status');
  }

  // Partner
  public async getPremiumHistory(userId: string): Promise<any[]> {
    return this.request<any[]>(`/partner/premium-history/${userId}`);
  }

  public async getReferrals(userId: string): Promise<any[]> {
    return this.request<any[]>(`/partner/referrals/${userId}`);
  }

  public async getEarningsSummary(userId: string): Promise<{ total_earnings: number, total_withdrawn: number, available_balance: number }> {
    return this.request<{ total_earnings: number, total_withdrawn: number, available_balance: number }>(`/partner/earnings-summary/${userId}`);
  }

  public async simulatePurchase(data: { userId: string, planTier: string, amount: number, months: number }): Promise<any> {
    return this.request<any>('/partner/simulate-purchase', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async requestWithdrawal(data: { userId: string, amount: number, address: string }): Promise<any> {
    return this.request<any>('/partner/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async sendSupportMessage(userId: string, message: string): Promise<SupportMessage> {
    return this.request<SupportMessage>('/support/message', {
      method: 'POST',
      body: JSON.stringify({ userId, message }),
    });
  }

  public async getSupportHistory(userId: string): Promise<SupportMessage[]> {
    return this.request<SupportMessage[]>(`/support/history/${userId}`);
  }
}

export const apiService = ApiService.getInstance();
