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
import { Hook, type HookHandlers } from './hook.js'
import { HookEvent } from './hook_event.js'

interface TransmitOptions extends Partial<HookHandlers> {
  baseUrl: string
  uidGenerator?: () => string
  eventSourceFactory?: (url: string | URL, options: { withCredentials: boolean }) => EventSource
  eventTargetFactory?: () => EventTarget | null
  httpClientFactory?: (baseUrl: string, uid: string) => HttpClient
  maxReconnectAttempts?: number
}

/**
 * Options once defaults are applied. Built once in the constructor.
 */
type ResolvedTransmitOptions = TransmitOptions &
  Required<
    Pick<
      TransmitOptions,
      | 'uidGenerator'
      | 'eventSourceFactory'
      | 'eventTargetFactory'
      | 'httpClientFactory'
      | 'maxReconnectAttempts'
    >
  >

export class Transmit {
  /**
   * Unique identifier for this client.
   */
  #uid: string

  /**
   * Options for this client.
   */
  #options: ResolvedTransmitOptions

  /**
   * Registered subscriptions.
   */
  #subscriptions = new Map<string, Subscription>()

  /**
   * Subscriptions whose create() waits for the connection to open, with
   * the promise create() returned. The open handler sends them, close()
   * settles them.
   */
  #pendingCreates = new Map<
    Subscription,
    { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void }
  >()

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
    this.#options = {
      ...options,
      uidGenerator: options.uidGenerator ?? (() => crypto.randomUUID()),
      eventSourceFactory: options.eventSourceFactory ?? ((...args) => new EventSource(...args)),
      eventTargetFactory: options.eventTargetFactory ?? (() => new EventTarget()),
      httpClientFactory:
        options.httpClientFactory ?? ((baseUrl, uid) => new HttpClient({ baseUrl, uid })),
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
    }

    this.#uid = this.#options.uidGenerator()
    this.#eventTarget = this.#options.eventTargetFactory()
    this.#hooks = new Hook()
    this.#httpClient = this.#options.httpClientFactory(this.#options.baseUrl, this.#uid)

    for (const event of Object.values(HookEvent)) {
      const handler = options[event]
      if (handler) {
        this.#hooks.register(event, handler)
      }
    }

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

    this.#eventSource = this.#options.eventSourceFactory(url, {
      withCredentials: true,
    })

    this.#eventSource.addEventListener('message', this.#onMessage.bind(this))
    this.#eventSource.addEventListener('error', this.#onError.bind(this))
    this.#eventSource.addEventListener('open', () => {
      this.#changeStatus(TransmitStatus.Connected)
      this.#reconnectAttempts = 0

      for (const subscription of this.#subscriptions.values()) {
        //? A 'connected' listener or a beforeSubscribe hook may have closed the client.
        //? close() also empties #pendingCreates, which ends the loop below.
        if (this.#status !== TransmitStatus.Connected) {
          return
        }

        if (subscription.isCreated) {
          void subscription.$subscribe()
        }
      }

      for (const [subscription, { resolve, reject }] of this.#pendingCreates) {
        subscription.$subscribe().then(resolve, reject)
      }

      this.#pendingCreates.clear()
    })
  }

  /**
   * Handles subscription.create(): subscribes now when connected,
   * otherwise waits for the open handler or close().
   */
  #requestCreate(subscription: Subscription) {
    //? Reuse the waiting request, e.g. when create() runs again in a 'connected' listener
    const waiting = this.#pendingCreates.get(subscription)

    if (waiting) {
      return waiting.promise
    }

    if (this.#status === TransmitStatus.Connected) {
      return subscription.$subscribe()
    }

    if (this.#status === TransmitStatus.Closed) {
      return Promise.resolve()
    }

    let resolve!: () => void
    let reject!: (error: unknown) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })

    this.#pendingCreates.set(subscription, { promise, resolve, reject })

    return promise
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
      console.error(error)
    }
  }

  #onError() {
    if (this.#status !== TransmitStatus.Reconnecting) {
      this.#changeStatus(TransmitStatus.Disconnected)
    }

    if (this.#reconnectAttempts >= this.#options.maxReconnectAttempts) {
      this.close()

      this.#hooks.run(HookEvent.OnReconnectFailed)

      return
    }

    this.#changeStatus(TransmitStatus.Reconnecting)
    this.#reconnectAttempts++
    this.#hooks.run(HookEvent.OnReconnectAttempt, this.#reconnectAttempts)
  }

  subscription(channel: string) {
    if (this.#subscriptions.has(channel)) {
      return this.#subscriptions.get(channel)!
    }

    const subscription: Subscription = new Subscription({
      channel,
      httpClient: this.#httpClient,
      hooks: this.#hooks,
      onCreate: () => this.#requestCreate(subscription),
      onDelete: () => this.#subscriptions.delete(channel),
    })

    this.#subscriptions.set(channel, subscription)

    return subscription
  }

  on(event: Exclude<TransmitStatus, 'connecting'>, callback: (event: CustomEvent) => void) {
    // @ts-ignore
    this.#eventTarget?.addEventListener(event, callback)
  }

  off(event: Exclude<TransmitStatus, 'connecting'>, callback: (event: CustomEvent) => void) {
    // @ts-ignore
    this.#eventTarget?.removeEventListener(event, callback)
  }

  close() {
    this.#eventSource?.close()
    this.#changeStatus(TransmitStatus.Closed)

    //? A closed client never connects again, so stop waiting for it
    for (const { resolve } of this.#pendingCreates.values()) {
      resolve()
    }

    this.#pendingCreates.clear()
  }
}
