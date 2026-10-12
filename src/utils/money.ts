export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

// Shows "+$5.00" / "−$5.00" so each line reads as a step in a sum
export const signedCurrency = (amount: number) => {
  const cents = Math.round(amount * 100);
  if (cents === 0) return formatCurrency(0);
  return `${cents > 0 ? '+' : '−'}${formatCurrency(Math.abs(cents) / 100)}`;
};
