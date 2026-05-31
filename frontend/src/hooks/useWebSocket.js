// frontend/src/hooks/useWebSocket.js
// Custom hook for resilient WebSocket management with auto-reconnect

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

/**
 * useWebSocket: Manages WebSocket connection with resilience
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Queue outgoing messages during disconnection
 * - Error boundary handling
 */
export function useWebSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const messageQueueRef = useRef([]);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  // Initialize WebSocket
  useEffect(() => {
    if (socketRef.current) return; // Already initialized

    socketRef.current = io(API_BASE, {
      reconnection: true,
      reconnectionDelay: baseReconnectDelay,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: maxReconnectAttempts,
      transports: ['websocket', 'polling'],
    });

    // Connection established
    socketRef.current.on('connect', () => {
      console.log('✅ WebSocket connected:', socketRef.current.id);
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;

      // Send queued messages
      while (messageQueueRef.current.length > 0) {
        const { event, data, callback } = messageQueueRef.current.shift();
        socketRef.current.emit(event, data, callback);
      }
    });

    // Connection lost
    socketRef.current.on('disconnect', (reason) => {
      console.warn('⚠️ WebSocket disconnected:', reason);
      setIsConnected(false);
      setError(`Connection lost: ${reason}`);
    });

    // Reconnection attempt
    socketRef.current.on('reconnect_attempt', () => {
      reconnectAttemptsRef.current++;
      console.log(`🔄 Reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
    });

    // Failed to reconnect
    socketRef.current.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect after', maxReconnectAttempts, 'attempts');
      setError('Failed to reconnect to server. Please refresh the page.');
    });

    // Connection error
    socketRef.current.on('connect_error', (error) => {
      console.error('🚫 WebSocket error:', error.message);
      setError(`Connection error: ${error.message}`);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  /**
   * Subscribe to price updates for a ticker
   */
  const subscribe = useCallback((ticker, onUpdate) => {
    if (!socketRef.current) return;

    socketRef.current.emit('subscribe', ticker);
    socketRef.current.on('price-update', onUpdate);

    return () => {
      socketRef.current.off('price-update', onUpdate);
      socketRef.current.emit('unsubscribe', ticker);
    };
  }, []);

  /**
   * Get current price (on-demand)
   */
  const getPrice = useCallback((ticker) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !socketRef.current.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      socketRef.current.emit('get-price', ticker, (response) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }, []);

  /**
   * Emit event (with queuing if disconnected)
   */
  const emit = useCallback((event, data, callback) => {
    if (!socketRef.current) {
      messageQueueRef.current.push({ event, data, callback });
      return;
    }

    if (socketRef.current.connected) {
      socketRef.current.emit(event, data, callback);
    } else {
      messageQueueRef.current.push({ event, data, callback });
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    subscribe,
    getPrice,
    emit,
  };
}
