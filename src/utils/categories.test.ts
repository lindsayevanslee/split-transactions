import { describe, it, expect } from 'vitest';
import { DEFAULT_CATEGORIES } from '../types';
import { OTHER_CATEGORY_VALUE, getCategoryOptions, findCategoryOption, resolveCategory } from './categories';

const withCategories = (categories: string[], customCategories: string[] = []) => ({
  transactions: categories.map(category => ({ category })) as never,
  customCategories,
});

describe('getCategoryOptions', () => {
  it('returns the presets for a group with no transactions', () => {
    expect(getCategoryOptions(withCategories([]))).toEqual(DEFAULT_CATEGORIES);
  });

  it('does not offer a preset named Other (the Other option is separate)', () => {
    expect(DEFAULT_CATEGORIES).not.toContain('Other');
  });

  it('adds categories already used in the group, sorted, after the presets', () => {
    const options = getCategoryOptions(withCategories(['Rent', 'Shopping', 'Gifts']));
    expect(options).toEqual([...DEFAULT_CATEGORIES, 'Gifts', 'Rent']);
  });

  it('includes the group customCategories field', () => {
    expect(getCategoryOptions(withCategories([], ['Pets']))).toContain('Pets');
  });

  it('dedupes ignoring case and whitespace, keeping the first spelling', () => {
    const options = getCategoryOptions(withCategories(['  rent ', 'Rent', 'food & dining']));
    expect(options.filter(o => o.toLowerCase() === 'rent')).toEqual(['rent']);
    expect(options.filter(o => o.toLowerCase() === 'food & dining')).toEqual(['Food & Dining']);
  });

  it('skips empty or missing categories', () => {
    const group = withCategories(['', '   ']);
    (group.transactions as unknown as { category?: string }[]).push({});
    expect(getCategoryOptions(group)).toEqual(DEFAULT_CATEGORIES);
  });
});

describe('findCategoryOption', () => {
  const options = ['Food & Dining', 'Rent'];

  it('matches ignoring case and surrounding whitespace', () => {
    expect(findCategoryOption('  food & DINING ', options)).toBe('Food & Dining');
  });

  it('returns undefined for no match or blank input', () => {
    expect(findCategoryOption('Pets', options)).toBeUndefined();
    expect(findCategoryOption('  ', options)).toBeUndefined();
  });
});

describe('resolveCategory', () => {
  const options = ['Food & Dining', 'Rent'];

  it('returns the selected option when Other is not chosen', () => {
    expect(resolveCategory('Rent', 'ignored', options)).toBe('Rent');
  });

  it('returns the trimmed custom text when Other is chosen', () => {
    expect(resolveCategory(OTHER_CATEGORY_VALUE, '  Pets ', options)).toBe('Pets');
  });

  it('uses the existing spelling when the custom text matches an option', () => {
    expect(resolveCategory(OTHER_CATEGORY_VALUE, 'rent', options)).toBe('Rent');
  });

  it('returns an empty string when nothing usable is chosen', () => {
    expect(resolveCategory('', '', options)).toBe('');
    expect(resolveCategory(OTHER_CATEGORY_VALUE, '   ', options)).toBe('');
  });
});
