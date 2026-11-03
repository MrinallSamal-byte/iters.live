/**
 * Wrap an async Express handler so a rejected promise is forwarded to the
 * error middleware. Express 4 does not do this on its own: without it, a
 * thrown error inside an async handler leaves the request hanging and (on
 * modern Node) takes the whole process down as an unhandled rejection.
 */
function asyncHandler(handler) {
  return function wrappedAsyncHandler(req, res, next) {
    return Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}

module.exports = asyncHandler;
