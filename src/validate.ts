import { ZodError, ZodType } from 'zod'

export function validate<T extends | ZodType>(
  obj: any,
  schema: T,
): void {
  try {
    schema.parse(obj)
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(
        `Error validating object with schema ${
          schema.description
        }: ${JSON.stringify(err.issues)}`,
      )
    }
    throw err
  }
}
