export type CommandErrorCode =
  | 'forbidden'
  | 'invalid_fields'
  | 'invalid_schedule'
  | 'invalid_outcome'
  | 'not_found'
  | 'unavailable'

const messages: Record<CommandErrorCode, string> = {
  forbidden: 'This client is not authorized for that Command operation.',
  invalid_fields: 'The proposed fields do not match the current type schema.',
  invalid_schedule: 'The proposed commitment is not valid for that record.',
  invalid_outcome: 'The proposed outcome is not valid for that commitment.',
  not_found: 'The requested Command record is unavailable.',
  unavailable: 'Command data is temporarily unavailable.',
}

export function commandError(code: CommandErrorCode): Error {
  const error = new Error(messages[code])
  error.name = 'CommandSafeError'
  return error
}

export function publicErrorMessage(error: unknown): string {
  return error instanceof Error && error.name === 'CommandSafeError'
    ? error.message
    : messages.unavailable
}
