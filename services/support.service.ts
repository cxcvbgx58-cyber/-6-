
import { BehaviorSubject, Subject } from 'rxjs';
import { SupportMessage } from '../models';
import { apiService } from './api.service';

export class SupportService {
  private static instance: SupportService;
  private messagesSubject = new BehaviorSubject<SupportMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  private socket: WebSocket | null = null;
  private userId: string | null = null;

  private constructor() {}

  public static getInstance(): SupportService {
    if (!SupportService.instance) {
      SupportService.instance = new SupportService();
    }
    return SupportService.instance;
  }

  public async initialize(userId: string) {
    this.userId = userId;
    try {
      const history = await apiService.getSupportHistory(userId);
      this.messagesSubject.next(history);
      this.connectWebSocket();
    } catch (error) {
      console.error('Failed to initialize support service:', error);
    }
  }

  private connectWebSocket() {
    if (this.socket) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('[SupportService] Socket connected');
      if (this.userId) {
        this.socket?.send(JSON.stringify({
          type: 'IDENTIFY',
          userId: this.userId
        }));
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SUPPORT_MESSAGE_RECEIVED') {
          const currentMessages = this.messagesSubject.value;
          
          // Check if message already exists by ID
          if (currentMessages.find(m => m.id === data.message.id)) {
            return;
          }

          // DEDUPLICATION: Check if this is a confirmed version of an optimistic message
          const optimisticIndex = currentMessages.findIndex(m => 
            m.id.startsWith('temp-') && 
            m.message === data.message.message && 
            m.user_id === data.message.user_id
          );

          if (optimisticIndex !== -1) {
            // Replace the optimistic message with the real one from WebSocket
            const newMessages = [...currentMessages];
            newMessages[optimisticIndex] = data.message;
            this.messagesSubject.next(newMessages);
          } else {
            // New message (e.g. from admin or another device)
            this.messagesSubject.next([...currentMessages, data.message]);
          }
        }
      } catch (e) {
        console.error('[SupportService] Error parsing socket message:', e);
      }
    };

    this.socket.onclose = () => {
      console.warn('[SupportService] Socket closed. Reloading page...');
      window.location.reload();
    };
  }

  public async sendMessage(userId: string, text: string) {
    if (!text.trim()) return;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: SupportMessage = {
      id: tempId,
      user_id: userId,
      message: text,
      sender_type: 'user',
      created_at: new Date().toISOString()
    };

    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, optimisticMsg]);

    try {
      const realMsg = await apiService.sendSupportMessage(userId, text);
      const current = this.messagesSubject.value;
      
      // If realMsg is already in the list (added by WebSocket), just remove the temp one
      if (current.find(m => m.id === realMsg.id)) {
        this.messagesSubject.next(current.filter(m => m.id !== tempId));
      } else {
        // Otherwise replace temp one with real one
        this.messagesSubject.next(current.map(m => m.id === tempId ? realMsg : m));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      const rolledBack = this.messagesSubject.value.filter(m => m.id !== tempId);
      this.messagesSubject.next(rolledBack);
      throw error;
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.messagesSubject.next([]);
  }
}

export const supportService = SupportService.getInstance();
