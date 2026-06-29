export class BadRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BadRequestError'
  }
}

export class ConcurrencyConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConcurrencyConflictError'
  }
}
