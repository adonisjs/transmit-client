<div align="center">
  <h1> AdonisJS Transmit Client</h1>
  <p>A client for the native Server-Sent-Event (SSE) module of AdonisJS.</p>
</div>

<br />

<div align="center">

[![gh-workflow-image]][gh-workflow-url] [![npm-image]][npm-url] ![][typescript-image] [![license-image]][license-url] [![synk-image]][synk-url]

</div>

<div align="center">
  <h3>
    <a href="#installation">
      Usage
    </a>
    <span> | </span>
    <a href="https://adonisjs.com">
      Checkout AdonisJS
    </a>
  </h3>
</div>

<br />

<hr />

AdonisJS Transmit Client is a client for the native Server-Sent-Event (SSE) module of AdonisJS. It is built on top of the [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) API and provides a simple API to receive events from the server.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

  - [Installation](#installation)
  - [Usage](#usage)
  - [Creating a subscription](#creating-a-subscription)
    - [Unsubscribing](#unsubscribing)
    - [Subscription Request](#subscription-request)
    - [Reconnecting](#reconnecting)
- [Events](#events)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

Install the package from the npm registry as follows:

```sh
npm i @adonisjs/transmit-client
```

## Usage

The module exposes a `Transmit` class, which can be used to connect to the server and listen for events.

```ts
import { Transmit } from '@adonisjs/transmit-client'

const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
})
```

## Creating a subscription

The `subscription` method is used to create a subscription to a channel. The method accepts the channel name

```ts
const subscription = transmit.subscription('chat/1')
```

Then, you have to call the `create` method on the subscription to register it on the backend.

```ts
await subscription.create()
```

You can listen for events on the channel using the `onMessage` method. You can define as many listeners as you want on the same subscription.

```ts
subscription.onMessage((message) => {
  console.log(message)
})
```

You can also listen only once for a message using the `onMessagetOnce` method.

```ts
subscription.onMessageOnce((message) => {
  console.log('I will be called only once')
})
```

Note listeners are local only; you can add them before or after registering your subscription on the server.

### Unsubscribing

The `onMessage` method returns a function to remove the message handler from the subscription.

```ts
const unsubscribe = subscription.onMessage(() => {
  console.log('message received!')
})

// later
unsubscribe()
```

If you want to entirely remove the subscription from the server, you can call the `delete` method.

```ts
await subscription.delete()
```

### Subscription Request

You can alter the subscription request by using the `beforeSubscribe` or `beforeUnsubscribe` options.

```ts
const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
  beforeSubscribe: (_request: Request) => {
    console.log('beforeSubscribe')
  },
  beforeUnsubscribe: (_request: Request) => {
    console.log('beforeUnsubscribe')
  },
})
```

### Reconnecting

The transmit client will automatically reconnect to the server when the connection is lost. You can change the number of retries and hook into the reconnect lifecycle as follows:

```ts
const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
  maxReconnectionAttempts: 5,
  onReconnectAttempt: (attempt) => {
    console.log('Reconnect attempt ' + attempt)
  },
  onReconnectFailed: () => {
    console.log('Reconnect failed')
  },
})
```

# Events

The`Transmit` class uses the [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) class to emits multiple events.

  ```ts
transmit.on('connected', () => {
  console.log('connected')
})

transmit.on('disconnected', () => {
  console.log('disconnected')
})

transmit.on('reconnecting', () => {
  console.log('reconnecting')
})
```

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/adonisjs/transmit-client/test?style=for-the-badge
[gh-workflow-url]: https://github.com/adonisjs/transmit-client/actions/workflows/test.yml "Github action"

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"

[npm-image]: https://img.shields.io/npm/v/@adonisjs/transmit-client.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/@adonisjs/transmit-client 'npm'

[license-image]: https://img.shields.io/npm/l/@adonisjs/transmit-client?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md 'license'

[synk-image]: https://img.shields.io/snyk/vulnerabilities/github/adonisjs/transmit-client?label=Synk%20Vulnerabilities&style=for-the-badge
[synk-url]: https://snyk.io/test/github/adonisjs/transmit-client?targetFile=package.json "synk"
