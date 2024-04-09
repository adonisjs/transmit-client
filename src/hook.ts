/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { HookEvent } from './hook_event.js'

export class Hook {
  #handlers = new Map<HookEvent, Set<(...args: any[]) => void>>()

  register(event: HookEvent, handler: (...args: any[]) => void) {
    if (!this.#handlers.has(event)) {
      this.#handlers.set(event, new Set())
    }

    this.#handlers.get(event)?.add(handler)

    return this
  }

  beforeSubscribe(request: Request) {
    this.#handlers.get(HookEvent.BeforeSubscribe)?.forEach((handler) => handler(request))

    return this
  }

  beforeUnsubscribe(request: Request) {
    this.#handlers.get(HookEvent.BeforeUnsubscribe)?.forEach((handler) => handler(request))

    return this
  }

  onReconnectAttempt(attempt: number) {
    this.#handlers.get(HookEvent.OnReconnectAttempt)?.forEach((handler) => handler(attempt))

    return this
  }

  onReconnectFailed() {
    this.#handlers.get(HookEvent.OnReconnectFailed)?.forEach((handler) => handler())

    return this
  }

  onSubscribeFailed(response: Response) {
    this.#handlers.get(HookEvent.OnSubscribeFailed)?.forEach((handler) => handler(response))

    return this
  }

  onSubscription(channel: string) {
    this.#handlers.get(HookEvent.OnSubscription)?.forEach((handler) => handler(channel))

    return this
  }

  onUnsubscription(channel: string) {
    this.#handlers.get(HookEvent.OnUnsubscription)?.forEach((handler) => handler(channel))

    return this
  }
}
