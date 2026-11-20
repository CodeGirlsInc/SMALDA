import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * JSON columns are unbounded in Postgres. Cap the serialized size so a
 * caller cannot turn a validation request into an arbitrarily large row.
 */
export const MAX_JSON_PAYLOAD_BYTES = 64 * 1024;

export function jsonPayloadSize(value: unknown): number {
  if (value === undefined || value === null) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function assertJsonPayloadSize(value: unknown, field: string): void {
  if (jsonPayloadSize(value) > MAX_JSON_PAYLOAD_BYTES) {
    throw new Error(`${field} exceeds the maximum size of ${MAX_JSON_PAYLOAD_BYTES} bytes`);
  }
}

export function IsBoundedJson(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isBoundedJson',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return jsonPayloadSize(value) <= MAX_JSON_PAYLOAD_BYTES;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must not exceed ${MAX_JSON_PAYLOAD_BYTES} bytes when serialized`;
        },
      },
    });
  };
}
