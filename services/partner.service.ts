
import { STORAGE_PREFIX } from '../models';

const AUTH0_URL = 'https://tiger-trade.eu.auth0.com/oauth/token';
const BASE_URL = 'https://trade-web-gtw.tiger.trade/cashback/protected/api/v1/referral';
const CLIENT_ID = 'YxomlOBhCnPXSisQXp44xGl6pp4yf7IA';
const AUDIENCE = 'https://partner.tiger.trade';

export interface PartnerAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface ReferralData {
  apiKey?: string;
  email?: string;
  emailHash?: string;
  userId: string | null;
  isReferral: boolean;
  isActive: boolean;
}

export interface EarningReport {
  userId: string;
  userJoined: string;
  userLeft: string | null;
  email: string;
  emailHash: string;
  tradingSection: string;
  tradingDay: string;
  tradingVolume: number;
  tradingCommission: number;
  partnerEarnings: number;
}

class PartnerService {
  private getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_PREFIX + 'partner_token');
  }

  private setAccessToken(token: string) {
    localStorage.setItem(STORAGE_PREFIX + 'partner_token', token);
  }

  async login(username: string, password: string): Promise<PartnerAuthResponse> {
    const response = await fetch(AUTH0_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        audience: AUDIENCE,
        grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
        realm: 'Partner-Authentication',
        username,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Login failed');
    }

    const data: PartnerAuthResponse = await response.json();
    this.setAccessToken(data.access_token);
    return data;
  }

  async checkReferralsByApiKeys(apiKeys: string[]): Promise<ReferralData[]> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No access token');

    const response = await fetch(`${BASE_URL}/apiKeys`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ apiKeys }),
    });

    if (!response.ok) throw new Error('Failed to check referrals');
    const result = await response.json();
    return result.data;
  }

  async checkReferralsByEmails(emails: string[]): Promise<ReferralData[]> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No access token');

    const response = await fetch(`${BASE_URL}/emails`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ emails }),
    });

    if (!response.ok) throw new Error('Failed to check referrals');
    const result = await response.json();
    return result.data;
  }

  async checkReferralsByEmailHashes(emailHashes: string[]): Promise<ReferralData[]> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No access token');

    const response = await fetch(`${BASE_URL}/emailHashes`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ emailHashes }),
    });

    if (!response.ok) throw new Error('Failed to check referrals');
    const result = await response.json();
    return result.data;
  }

  async checkReferralsByUserIds(userIds: string[]): Promise<ReferralData[]> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No access token');

    const response = await fetch(`${BASE_URL}/userIds`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ userIds }),
    });

    if (!response.ok) throw new Error('Failed to check referrals');
    const result = await response.json();
    return result.data;
  }

  async getEarnings(dateFrom: string, dateTo: string, page = 0, size = 100, userId?: string): Promise<EarningReport[]> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No access token');

    let url = `${BASE_URL}/earnings?dateFrom=${dateFrom}&dateTo=${dateTo}&page=${page}&size=${size}`;
    if (userId) url += `&userId=${userId}`;

    const response = await fetch(url, {
      headers: {
        'authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch earnings');
    const result = await response.json();
    return result.data;
  }

  logout() {
    localStorage.removeItem(STORAGE_PREFIX + 'partner_token');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

export const partnerService = new PartnerService();
