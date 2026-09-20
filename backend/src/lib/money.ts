/** Visa sends amounts as decimal strings in major units, e.g. 1200 cents -> "12.00". */
export function centsToVisaAmount(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error(`amount must be integer cents, got ${cents}`);
  if (cents < 0) throw new Error(`amount must be non-negative, got ${cents}`);
  return (cents / 100).toFixed(2);
}

export function visaAmountToCents(amount: string): number {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents)) throw new Error(`could not parse Visa amount "${amount}"`);
  return cents;
}
