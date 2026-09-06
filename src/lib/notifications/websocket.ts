import { Notification } from '@/lib/types/notification';

export class NotificationWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private userId: string;
  private onNotificationCallback: ((notification: Notification) => void) | null = null;
  private onConnectionStatusCallback: ((status: 'connected' | 'disconnected' | 'reconnecting') => void) | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/notifications`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        this.ws?.send(JSON.stringify({
          type: 'auth',
          userId: this.userId,
        }));

        this.onConnectionStatusCallback?.('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'notification') {
            this.onNotificationCallback?.(data.notification);
          } else if (data.type === 'ping') {
            this.ws?.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.onConnectionStatusCallback?.('disconnected');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.onConnectionStatusCallback?.('reconnecting');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      console.log(`Attempting to reconnect... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, this.reconnectDelay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onNotification(callback: (notification: Notification) => void) {
    this.onNotificationCallback = callback;
  }

  onConnectionStatus(callback: (status: 'connected' | 'disconnected' | 'reconnecting') => void) {
    this.onConnectionStatusCallback = callback;
  }

  sendMessage(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  getConnectionState() {
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }
}