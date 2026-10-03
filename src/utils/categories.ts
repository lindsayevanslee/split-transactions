import { DEFAULT_CATEGORIES, Group } from '../types';

// Select value for the "Other" option. Not a real category: choosing it shows
// a text field, and whatever is typed there is saved as the category.
export const OTHER_CATEGORY_VALUE = '__other__';

/**
 * Categories offered in the dropdown: the presets first, then any the group
 * has already used (custom ones entered via "Other", or older free-text
 * values), so they can be picked again. Matching ignores case and whitespace.
 */
export function getCategoryOptions(group: Pick<Group, 'transactions' | 'customCategories'>): string[] {
  const options: string[] = [];
  const seen = new Set<string>();
  const add = (category: string | undefined) => {
    const trimmed = category?.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push(trimmed);
  };

  DEFAULT_CATEGORIES.forEach(add);

  const extras = [
    ...(group.customCategories || []),
    ...(group.transactions || []).map(t => t.category),
  ];
  const before = options.length;
  extras.forEach(add);
  const custom = options.splice(before).sort((a, b) => a.localeCompare(b));

  return [...options, ...custom];
}

/**
 * Returns the option matching `category` (ignoring case and surrounding
 * whitespace), or undefined if there is none.
 */
export function findCategoryOption(category: string, options: string[]): string | undefined {
  const key = category.trim().toLowerCase();
  if (!key) return undefined;
  return options.find(option => option.toLowerCase() === key);
}

/**
 * The category to save. A custom value that matches an existing option is
 * saved with that option's spelling, so "food & dining" doesn't become a
 * second category next to "Food & Dining".
 */
export function resolveCategory(selected: string, customText: string, options: string[]): string {
  if (selected !== OTHER_CATEGORY_VALUE) return selected;
  return findCategoryOption(customText, options) ?? customText.trim();
}
