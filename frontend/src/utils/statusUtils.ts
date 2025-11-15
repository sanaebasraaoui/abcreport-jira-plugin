/**
 * Normalize status name for CSS class (removes accents and spaces, converts to lowercase)
 */
export function normalizeStatusForClass(status: string): string {
  return status
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[()]/g, ''); // Remove parentheses
}

/**
 * Get status category for styling (done, in-progress, to-do)
 */
export function getStatusCategory(status: string): 'done' | 'in-progress' | 'to-do' | 'other' {
  const normalized = normalizeStatusForClass(status);
  
  // Done statuses (English and French)
  if (
    normalized.includes('done') ||
    normalized.includes('closed') ||
    normalized.includes('resolved') ||
    normalized.includes('termine') ||
    normalized.includes('fini') ||
    normalized.includes('complete') ||
    normalized.includes('resolu')
  ) {
    return 'done';
  }
  
  // In Progress statuses (English and French)
  if (
    normalized.includes('in-progress') ||
    normalized.includes('in-progress') ||
    normalized.includes('in-development') ||
    normalized.includes('testing') ||
    normalized.includes('en-cours') ||
    normalized.includes('en-developpement') ||
    normalized.includes('en-test') ||
    normalized.includes('en-revue') ||
    normalized.includes('review')
  ) {
    return 'in-progress';
  }
  
  // To Do statuses (English and French)
  if (
    normalized.includes('to-do') ||
    normalized.includes('open') ||
    normalized.includes('ready') ||
    normalized.includes('a-faire') ||
    normalized.includes('a-realiser') ||
    normalized.includes('nouveau') ||
    normalized.includes('nouvelle') ||
    normalized.includes('pret') ||
    normalized.includes('backlog')
  ) {
    return 'to-do';
  }
  
  return 'other';
}

