const { default: MyPromise, NewPromiseCapability } = require('../lib/index')
module.exports = {
  deferred: () => {
    const c = NewPromiseCapability(MyPromise)
    return {
      promise: c.Promise,
      resolve: c.Resolve,
      reject: c.Reject
    }
  }
}
