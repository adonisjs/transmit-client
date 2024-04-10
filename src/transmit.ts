/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Subscription } from './subscription.js'
import { HttpClient } from './http_client.js'
import { TransmitStatus } from './transmit_status.js'
import { Hook } from './hook.js'
import { HookEvent } from './hook_event.js'

interface TransmitOptions {
  baseUrl: string
  uidGenerator?: () => string
  eventSourceFactory?: (url: string | URL, options: { withCredentials: boolean }) => EventSource
  eventTargetFactory?: () => EventTarget | null
  httpClientFactory?: (baseUrl: string, uid: string) => HttpClient
  beforeSubscribe?: (request: RequestInit) => void
  beforeUnsubscribe?: (request: RequestInit) => void
  maxReconnectAttempts?: number
  onReconnectAttempt?: (attempt: number) => void
  onReconnectFailed?: () => void
  onSubscribeFailed?: (response: Response) => void
  onSubscription?: (channel: string) => void
  onUnsubscription?: (channel: string) => void
}

export class Transmit {
  /**
   * Unique identifier for this client.
   */
  #uid: string

  /**
   * Options for this client.
   */
  #options: TransmitOptions

  /**
   * Registered subscriptions.
   */
  #subscriptions = new Map<string, Subscription>()

  /**
   * HTTP client instance.
   */
  #httpClient: HttpClient

  /**
   * Hook instance.
   */
  #hooks: Hook

  /**
   * Current status of the client.
   */
  #status: TransmitStatus = TransmitStatus.Initializing

  /**
   * EventSource instance.
   */
  #eventSource: EventSource | undefined

  /**
   * EventTarget instance.
   */
  #eventTarget: EventTarget | null

  /**
   * Number of reconnect attempts.
   */
  #reconnectAttempts: number = 0

  /**
   * Returns the unique identifier of the client.
   */
  get uid() {
    return this.#uid
  }

  constructor(options: TransmitOptions) {
    if (typeof options.uidGenerator === 'undefined') {
      options.uidGenerator = () => crypto.randomUUID()
    }

    if (typeof options.eventSourceFactory === 'undefined') {
      options.eventSourceFactory = (...args) => new EventSource(...args)
    }

    if (typeof options.eventTargetFactory === 'undefined') {
      options.eventTargetFactory = () => new EventTarget()
    }

    if (typeof options.httpClientFactory === 'undefined') {
      options.httpClientFactory = (baseUrl, uid) => new HttpClient({ baseUrl, uid })
    }

    if (typeof options.maxReconnectAttempts === 'undefined') {
      options.maxReconnectAttempts = 5
    }

    this.#uid = options.uidGenerator()
    this.#eventTarget = options.eventTargetFactory()
    this.#hooks = new Hook()
    this.#httpClient = options.httpClientFactory(options.baseUrl, this.#uid)

    if (options.beforeSubscribe) {
      this.#hooks.register(HookEvent.BeforeSubscribe, options.beforeSubscribe)
    }

    if (options.beforeUnsubscribe) {
      this.#hooks.register(HookEvent.BeforeUnsubscribe, options.beforeUnsubscribe)
    }

    if (options.onReconnectAttempt) {
      this.#hooks.register(HookEvent.OnReconnectAttempt, options.onReconnectAttempt)
    }

    if (options.onReconnectFailed) {
      this.#hooks.register(HookEvent.OnReconnectFailed, options.onReconnectFailed)
    }

    if (options.onSubscribeFailed) {
      this.#hooks.register(HookEvent.OnSubscribeFailed, options.onSubscribeFailed)
    }

    if (options.onSubscription) {
      this.#hooks.register(HookEvent.OnSubscription, options.onSubscription)
    }

    if (options.onUnsubscription) {
      this.#hooks.register(HookEvent.OnUnsubscription, options.onUnsubscription)
    }

    this.#options = options
    this.#connect()
  }

  #changeStatus(status: TransmitStatus) {
    this.#status = status
    this.#eventTarget?.dispatchEvent(new CustomEvent(status))
  }

  #connect() {
    this.#changeStatus(TransmitStatus.Connecting)

    const url = new URL(`${this.#options.baseUrl}/__transmit/events`)
    url.searchParams.append('uid', this.#uid)

    this.#eventSource = this.#options.eventSourceFactory!(url, {
      withCredentials: true,
    })

    this.#eventSource.addEventListener('message', this.#onMessage.bind(this))
    this.#eventSource.addEventListener('error', this.#onError.bind(this))
    this.#eventSource.addEventListener('open', () => {
      this.#changeStatus(TransmitStatus.Connected)
      this.#reconnectAttempts = 0

      for (const subscription of this.#subscriptions.values()) {
        if (subscription.isCreated) {
          void subscription.forceCreate()
        }
      }
    })
  }

  #onMessage(event: MessageEvent) {
    const data = JSON.parse(event.data)
    const subscription = this.#subscriptions.get(data.channel)

    if (typeof subscription === 'undefined') {
      return
    }

    try {
      subscription.$runHandler(data.payload)
    } catch (error) {
      // TODO: Rescue
      console.log(error)
    }
  }

  #onError() {
    if (this.#status !== TransmitStatus.Reconnecting) {
      this.#changeStatus(TransmitStatus.Disconnected)
    }

    this.#changeStatus(TransmitStatus.Reconnecting)

    this.#hooks.onReconnectAttempt(this.#reconnectAttempts + 1)

    if (
      this.#options.maxReconnectAttempts &&
      this.#reconnectAttempts >= this.#options.maxReconnectAttempts
    ) {
      this.#eventSource!.close()

      this.#hooks.onReconnectFailed()

      return
    }

    this.#reconnectAttempts++
  }

  subscription(channel: string) {
    const subscription = new Subscription({
      channel,
      httpClient: this.#httpClient,
      hooks: this.#hooks,
      getEventSourceStatus: () => this.#status,
    })

    if (this.#subscriptions.has(channel)) {
      return this.#subscriptions.get(channel)!
    }

    this.#subscriptions.set(channel, subscription)

    return subscription
  }

  on(event: Exclude<TransmitStatus, 'connecting'>, callback: (event: CustomEvent) => void) {
    // @ts-ignore
    this.#eventTarget?.addEventListener(event, callback)
  }

  close() {
    this.#eventSource?.close()
  }
}
