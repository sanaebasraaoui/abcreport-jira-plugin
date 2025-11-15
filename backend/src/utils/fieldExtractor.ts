/**
 * Field Extractor Utility
 * 
 * Utilities for extracting field values from Jira issues using field paths.
 * Supports nested paths like "fields.parent.fields.summary" or "fields.assignee.displayName".
 */

import { JiraIssue } from '../types/jira';

/**
 * Extract a field value from an issue using a field path
 * 
 * Supports:
 * - Direct fields: "summary" → issue.fields.summary
 * - Nested paths: "fields.parent.fields.summary" → issue.fields.parent.fields.summary
 * - Custom fields: "customfield_12345" → issue.fields.customfield_12345
 * - Object properties: "fields.assignee.displayName" → issue.fields.assignee.displayName
 * 
 * @param issue - Jira issue object
 * @param fieldPath - Field path (e.g., "fields.summary", "fields.parent.fields.summary")
 * @returns Field value or null if not found
 */
export function extractFieldValue(issue: JiraIssue, fieldPath: string): any {
  if (!fieldPath || !issue) {
    return null;
  }

  // Handle common shortcuts
  let path = fieldPath;
  
  // If path doesn't start with "fields.", prepend it (for convenience)
  if (!path.startsWith('fields.') && !path.startsWith('key') && !path.startsWith('id')) {
    // Check if it's a top-level property
    if (path === 'key' || path === 'id') {
      return (issue as any)[path] || null;
    }
    // Otherwise assume it's a field
    path = `fields.${path}`;
  }

  // Split path into parts
  const parts = path.split('.');
  
  // Start from issue
  let current: any = issue;

  // Navigate through the path
  for (const part of parts) {
    if (current === null || current === undefined) {
      return null;
    }

    // Handle array access (e.g., "labels[0]")
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      current = current[arrayName];
      
      if (Array.isArray(current) && current[index] !== undefined) {
        current = current[index];
      } else {
        return null;
      }
      continue;
    }

    // Normal property access
    current = current[part];
  }

  return current ?? null;
}

/**
 * Format a field value for display in the report
 * 
 * Handles different data types:
 * - Arrays: joins with separator
 * - Objects: extracts displayName or name property
 * - Dates: formats as readable string
 * - null/undefined: returns empty string or fallback
 * 
 * @param value - Field value to format
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatFieldValue(
  value: any,
  options: {
    multiValueHandling?: 'join' | 'first' | 'all';
    separator?: string;
    fallback?: string;
  } = {}
): string {
  const {
    multiValueHandling = 'join',
    separator = ', ',
    fallback = '-',
  } = options;

  if (value === null || value === undefined) {
    return fallback;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return fallback;
    }

    switch (multiValueHandling) {
      case 'first':
        return formatFieldValue(value[0], { fallback });
      case 'all':
        // Return array for "all" handling (caller will create separate rows)
        return value as any;
      case 'join':
      default:
        return value
          .map(item => formatFieldValue(item, { fallback }))
          .filter(item => item !== fallback)
          .join(separator);
    }
  }

  // Handle objects (like assignee with displayName)
  if (typeof value === 'object') {
    // Try common property names
    if (value.displayName) return value.displayName;
    if (value.name) return value.name;
    if (value.key) return value.key;
    if (value.summary) return value.summary;
    
    // If object has a string representation, use it
    if (value.toString && value.toString !== Object.prototype.toString) {
      return value.toString();
    }
    
    // Fall back to JSON string for complex objects
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  // Handle dates
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  // Handle date strings
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      const date = new Date(value);
      return date.toLocaleDateString();
    } catch {
      // Not a valid date, return as-is
    }
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Handle numbers
  if (typeof value === 'number') {
    return value.toString();
  }

  // Handle strings
  if (typeof value === 'string') {
    return value;
  }

  // Fallback
  return fallback;
}

/**
 * Extract and format a field value from an issue
 * 
 * Convenience function that combines extraction and formatting
 * 
 * @param issue - Jira issue object
 * @param fieldPath - Field path
 * @param options - Formatting options
 * @returns Formatted field value string
 */
export function getFieldDisplayValue(
  issue: JiraIssue,
  fieldPath: string,
  options: {
    multiValueHandling?: 'join' | 'first' | 'all';
    separator?: string;
    fallback?: string;
  } = {}
): string {
  const value = extractFieldValue(issue, fieldPath);
  return formatFieldValue(value, options);
}

