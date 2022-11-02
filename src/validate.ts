import { ZodError, ZodType } from 'zod'
import { ResponseError } from './types'

export function validate<T extends ZodType>(obj: any, schema: T): void {
  try {
    schema.parse(obj)
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ResponseError(
        `Error validating object with schema ${
          schema.description
        }. ${JSON.stringify(err.format()._errors)}`,
        err,
      )
    }
    throw err
  }
}
