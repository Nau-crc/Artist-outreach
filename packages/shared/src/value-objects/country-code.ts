const ISO_3166_1_ALPHA_2 = /^[A-Z]{2}$/

export class InvalidCountryCodeError extends Error {
  constructor(value: string) {
    super(`Invalid country code (expected ISO 3166-1 alpha-2): ${value}`)
    this.name = 'InvalidCountryCodeError'
  }
}

export class CountryCode {
  readonly value: string

  private constructor(value: string) {
    this.value = value
  }

  static parse(input: string): CountryCode {
    const normalized = input.trim().toUpperCase()
    if (!ISO_3166_1_ALPHA_2.test(normalized)) throw new InvalidCountryCodeError(input)
    return new CountryCode(normalized)
  }

  toString(): string {
    return this.value
  }
}
