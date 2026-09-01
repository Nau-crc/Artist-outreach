export type SubscribeSubmitResult = 'ok' | { error: string }

export interface SubscribeFormProps {
  onSubmit: (email: string) => Promise<SubscribeSubmitResult>
  privacyHref?: string
  testID?: string
}
