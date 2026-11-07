/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { HookEvent } from './hook_event.js'

/**
 * Signature of each hook. Source of truth for `Hook` and the hook
 * options of `Transmit`.
 */
export interface HookHandlers {
  [HookEvent.BeforeSubscribe]: (request: Request) => void
  [HookEvent.BeforeUnsubscribe]: (request: Request) => void
  [HookEvent.OnReconnectAttempt]: (attempt: number) => void
  [HookEvent.OnReconnectFailed]: () => void
  [HookEvent.OnSubscribeFailed]: (response: Response) => void
  [HookEvent.OnSubscription]: (channel: string) => void
  [HookEvent.OnUnsubscription]: (channel: string) => void
}

/**
 * Same signature as `HookHandlers[E]`, written so TypeScript can call it
 * with `Parameters<HookHandlers[E]>` while `E` is still generic.
 */
type HookHandler<E extends HookEvent> = (...args: Parameters<HookHandlers[E]>) => void

export class Hook {
  #handlers: { [E in HookEvent]: Set<HookHandler<E>> } = {
    [HookEvent.BeforeSubscribe]: new Set(),
    [HookEvent.BeforeUnsubscribe]: new Set(),
    [HookEvent.OnReconnectAttempt]: new Set(),
    [HookEvent.OnReconnectFailed]: new Set(),
    [HookEvent.OnSubscribeFailed]: new Set(),
    [HookEvent.OnSubscription]: new Set(),
    [HookEvent.OnUnsubscription]: new Set(),
  }

  register<E extends HookEvent>(event: E, handler: HookHandlers[E]) {
    // Same type, but TypeScript cannot prove it while `E` is generic.
    this.#handlers[event].add(handler as HookHandler<E>)

    return this
  }

  /**
   * Calls every handler registered for the event with the given arguments.
   */
  run<E extends HookEvent>(event: E, ...args: Parameters<HookHandlers[E]>) {
    this.#handlers[event].forEach((handler) => handler(...args))

    return this
  }
}
