export default class MyPromise {
  constructor(executor) {
    if (typeof executor !== 'function')
      throw new TypeError('executor must be a function')
    this.PromiseState = 'pending'
    this.PromiseResult = undefined
    this.PromiseFulfillReactions = []
    this.PromiseRejectReactions = []
    const resolvingFunctions = CreateResolvingFunctions(this)
    try {
      executor.call(
        undefined,
        resolvingFunctions.Resolve,
        resolvingFunctions.Reject
      )
    } catch (e) {
      const status = resolvingFunctions.Reject.call(undefined, e)
      return status
    }
  }

  then(onFulfilled, onRejected) {
    const promise = this
    const C = promise.constructor
    let resultCapability = NewPromiseCapability(C)
    return PerformPromiseThen(
      promise,
      onFulfilled,
      onRejected,
      resultCapability
    )
  }
}

function CreateResolvingFunctions(promise) {
  let alreadyResolved = {
    value: false
  }
  const resolve = resolution => {
    const promise = resolve.Promise
    const alreadyResolved = resolve.AlreadyResolved
    if (alreadyResolved.value === true) {
      return undefined
    }
    alreadyResolved.value = true
    if (resolution === promise) {
      const selfResolutionError = new TypeError('resolution === promise')
      return RejectPromise(promise, selfResolutionError)
    }
    if (!isObject(resolution)) {
      return FulfillPromise(promise, resolution)
    }
    let then
    try {
      then = resolution.then
    } catch (e) {
      return RejectPromise(promise, e)
    }
    let thenAction = then
    if (typeof thenAction !== 'function') {
      return FulfillPromise(promise, resolution)
    }
    queueMicrotask(() => {
      PromiseResolveThenableJob(promise, resolution, thenAction)
    })
  }
  resolve.Promise = promise
  resolve.AlreadyResolved = alreadyResolved
  const reject = reason => {
    const promise = reject.Promise
    const alreadyResolved = reject.AlreadyResolved
    if (alreadyResolved.value === true) {
      return undefined
    }
    alreadyResolved.value = true
    return RejectPromise(promise, reason)
  }
  reject.Promise = promise
  reject.AlreadyResolved = alreadyResolved
  return {
    Resolve: resolve,
    Reject: reject
  }
}

function RejectPromise(promise, reason) {
  const reactions = promise.PromiseRejectReactions
  promise.PromiseResult = reason
  promise.PromiseFulfillReactions = undefined
  promise.PromiseRejectReactions = undefined
  promise.PromiseState = 'rejected'
  return TriggerPromiseReactions(reactions, reason)
}

function TriggerPromiseReactions(reactions, argument) {
  reactions.forEach(reaction => {
    queueMicrotask(() => {
      PromiseReactionJob(reaction, argument)
    })
  })
}

function PromiseReactionJob(reaction, argument) {
  const promiseCapability = reaction.Capabilities
  const handler = reaction.Handler
  let handlerResult
  try {
    handlerResult = handler.call(undefined, argument)
  } catch (e) {
    promiseCapability.Reject.call(undefined, e)
  }
  return promiseCapability.Resolve.call(undefined, handlerResult)
}

function PromiseResolveThenableJob(promiseToResolve, thenable, then) {
  const resolvingFunctions = CreateResolvingFunctions(promiseToResolve)
  let thenCallResult
  try {
    then.call(thenable, resolvingFunctions.Resolve, resolvingFunctions.Reject)
  } catch (e) {
    return resolvingFunctions.Reject.call(undefined, e)
  }
  return thenCallResult
}

function FulfillPromise(promise, value) {
  const reactions = promise.PromiseFulfillReactions
  promise.PromiseResult = value
  promise.PromiseFulfillReactions = undefined
  promise.PromiseRejectReactions = undefined
  promise.PromiseState = 'fulfilled'
  return TriggerPromiseReactions(reactions, value)
}

function Identify(data) {
  return data
}

function Thrower(e) {
  throw e
}

export function NewPromiseCapability(C) {
  let promiseCapability = {
    Promise: undefined,
    Resolve: undefined,
    Reject: undefined
  }
  let executor = (resolve, reject) => {
    let promiseCapability = executor.Capability
    if (promiseCapability.Resolve !== undefined) {
      throw new TypeError()
    }
    if (promiseCapability.Reject !== undefined) {
      throw new TypeError()
    }
    promiseCapability.Resolve = resolve
    promiseCapability.Reject = reject
  }
  executor.Capability = promiseCapability
  let promise = new C(executor)
  if (typeof promiseCapability.Resolve !== 'function') {
    throw new TypeError()
  }
  if (typeof promiseCapability.Reject !== 'function') {
    throw new TypeError()
  }
  promiseCapability.Promise = promise
  return promiseCapability
}

function PerformPromiseThen(
  promise,
  onFulfilled,
  onRejected,
  resultCapability
) {
  if (typeof onFulfilled !== 'function') {
    onFulfilled = Identify
  }
  if (typeof onRejected !== 'function') {
    onRejected = Thrower
  }
  let fulfillReaction = {
    Capabilities: resultCapability,
    Handler: onFulfilled
  }
  let rejectReaction = {
    Capabilities: resultCapability,
    Handler: onRejected
  }
  if (promise.PromiseState === 'pending') {
    promise.PromiseFulfillReactions.push(fulfillReaction)
    promise.PromiseRejectReactions.push(rejectReaction)
  } else if (promise.PromiseState === 'fulfilled') {
    let value = promise.PromiseResult
    queueMicrotask(() => {
      PromiseReactionJob(fulfillReaction, value)
    })
  } else if (promise.PromiseState === 'rejected') {
    let value = promise.PromiseResult
    queueMicrotask(() => {
      PromiseReactionJob(rejectReaction, value)
    })
  }
  return resultCapability.Promise
}

function isObject(value) {
  const type = typeof value
  return value != null && (type === 'object' || type === 'function')
}

// var dummy = { dummy: 'dummy' }

// function done() {
//   console.log('done!')
// }
// var d = NewPromiseCapability(MyPromise)
// var onFulfilledCalled = false

// d.Promise.then(
//   function onFulfilled() {
//     onFulfilledCalled = true
//   },
//   function onRejected() {
//     done()
//   }
// )

// d.Resolve(dummy)
// d.Reject(dummy)
// setTimeout(done, 100)
