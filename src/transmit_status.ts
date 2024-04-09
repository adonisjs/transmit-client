/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export const TransmitStatus = {
  Initializing: 'initializing',
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnected: 'disconnected',
  Reconnecting: 'reconnecting',
} as const

export type TransmitStatus = (typeof TransmitStatus)[keyof typeof TransmitStatus]
