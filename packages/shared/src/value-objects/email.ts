const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class InvalidEmailError extends Error {
  constructor(value: string) {
    super(`Invalid email: ${value}`)
    this.name = 'InvalidEmailError'
  }
}

export class Email {
  readonly value: string

  private constructor(value: string) {
    this.value = value
  }

  static parse(input: string): Email {
    const normalized = Email.normalize(input)
    if (!EMAIL_REGEX.test(normalized)) throw new InvalidEmailError(input)
    return new Email(normalized)
  }

  static safeParse(input: string): { success: true; email: Email } | { success: false; error: InvalidEmailError } {
    try {
      return { success: true, email: Email.parse(input) }
    } catch (err) {
      return { success: false, error: err as InvalidEmailError }
    }
  }

  static normalize(input: string): string {
    return input.trim().toLowerCase().replace(/[​-‍﻿]/g, '')
  }

  toString(): string {
    return this.value
  }
}
