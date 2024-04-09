/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export const HookEvent = {
  BeforeSubscribe: 'beforeSubscribe',
  BeforeUnsubscribe: 'beforeUnsubscribe',
  OnReconnectAttempt: 'onReconnectAttempt',
  OnReconnectFailed: 'onReconnectFailed',
  OnSubscribeFailed: 'onSubscribeFailed',
  OnSubscription: 'onSubscription',
  OnUnsubscription: 'onUnsubscription',
} as const

export type HookEvent = (typeof HookEvent)[keyof typeof HookEvent]
