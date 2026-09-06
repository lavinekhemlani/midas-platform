/**
 * Client-side event tracking utility
 * Sends workflow events to server for logging
 */

type EventType = 'page_view' | 'button_click' | 'form_submit' | 'error' | 'success'

interface ClientEvent {
  event: string
  type: EventType
  metadata?: Record<string, any>
}

class ClientLogger {
  private queue: ClientEvent[] = []
  private isProcessing = false

  /**
   * Log a page view event
   */
  pageView(page: string, metadata?: Record<string, any>) {
    this.logEvent({
      event: `Page viewed: ${page}`,
      type: 'page_view',
      metadata,
    })
  }

  /**
   * Log a button click event
   */
  buttonClick(button: string, metadata?: Record<string, any>) {
    this.logEvent({
      event: `Button clicked: ${button}`,
      type: 'button_click',
      metadata,
    })
  }

  /**
   * Log a form submission
   */
  formSubmit(form: string, metadata?: Record<string, any>) {
    this.logEvent({
      event: `Form submitted: ${form}`,
      type: 'form_submit',
      metadata,
    })
  }

  /**
   * Log an error event
   */
  error(message: string, metadata?: Record<string, any>) {
    this.logEvent({
      event: `Error: ${message}`,
      type: 'error',
      metadata,
    })
  }

  /**
   * Log a success event
   */
  success(message: string, metadata?: Record<string, any>) {
    this.logEvent({
      event: `Success: ${message}`,
      type: 'success',
      metadata,
    })
  }

  /**
   * Internal method to queue and send events
   */
  private logEvent(event: ClientEvent) {
    // Add to queue
    this.queue.push(event)

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * Process the event queue
   */
  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true

    // Get all events from queue
    const events = [...this.queue]
    this.queue = []

    try {
      // Send events to server
      await fetch('/api/events/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      })
    } catch (error) {
      // If failed, add events back to queue for retry
      this.queue.unshift(...events)
      console.error('Failed to send events to server:', error)
    }

    this.isProcessing = false

    // Process any new events that were added while we were sending
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 1000)
    }
  }
}

// Export singleton instance
export const clientLogger = new ClientLogger()
