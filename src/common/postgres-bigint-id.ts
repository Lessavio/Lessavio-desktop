const POSTGRES_BIGINT_MAX = BigInt("9223372036854775807");

export function isPositivePostgresBigintId(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return false;

  try {
    return BigInt(value) <= POSTGRES_BIGINT_MAX;
  } catch {
    return false;
  }
}
