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

AdonisJS Transmit Client is a client for the native Server-Sent-Event (SSE) module of AdonisJS. It is built on top of the [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/ntSource) API and provides a simple API to receive events from the server.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

  - [Installation](#installation)
  - [Usage](#usage)
  - [Subscribing to channels](#subscribing-to-channels)
    - [Subscription Request](#subscription-request)
    - [Reconnecting](#reconnecting)
    - [Unsubscribing](#unsubscribing)
- [Events](#events)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

Install the package from the npm registry as follows:

```sh
npm i @adonisjs/transmit-client

# yarn
yarn add @adonisjs/transmit-client

# pnpm
pnpm add @adonisjs/transmit-client
```

## Usage

The module exposes a `Transmit` class, which can be used to connect to the server and listen for events.

```ts
import { Transmit } from '@adonisjs/transmit-client'

const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
})
```

## Subscribing to channels

The `listenOn` method accepts the channel name and a callback to be invoked when the event is received from the server.

```ts
transmit.listenOn<{ message: string }>('chat/1', (payload) => {
  console.log(payload.message)
})
```

You can also listen from a channel only once.

```ts
transmit.listenOnce<{ message: string }>('chat/1', () => {
  console.log('first message received!')
})
```

### Subscription Request

You can alter the subscription request by using the `beforeSubscribe` or `beforeUnsubscribe` options.

```ts
const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
  beforeSubscribe: (_request: RequestInit) => {
    console.log('beforeSubscribe')
  },
  beforeUnsubscribe: (_request: RequestInit) => {
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

### Unsubscribing

The `listenOn` method returns a function to unsubscribe from the channel.

```ts
const unsubscribe = transmit.listenOn('chat/1', () => {
  console.log('message received!')
})

// later
unsubscribe()
```

When unsubscribing from a channel, the client will remove the local listener for that channel. By default, it will not send a request to the server when there are no more listener to unsubscribe from the channel. You can change this behavior by setting the `removeSubscriptionOnZeroListener` option to `true`.

```ts
const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
  removeSubscriptionOnZeroListener: true,
})
```

You can also change the default settings locally by passing a boolean to the unsubscribe method.

```ts
const unsubscribe = transmit.listenOn('chat/1', () => {
  console.log('message received!')
})

// later
unsubscribe(true) // or false
```

# Events

The`Transmit` class extends the [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) class and emits multiple events.

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
