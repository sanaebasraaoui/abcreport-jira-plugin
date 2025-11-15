/**
 * Template Types (Frontend)
 * 
 * Type definitions for report templates in the frontend.
 * These mirror the backend template types.
 */

/**
 * Field path type for accessing nested issue fields
 */
export type FieldPath = string;

/**
 * Issue selection configuration
 */
export interface IssueSelectionConfig {
  maxDepth: number;
  includeNestedChildren: boolean;
  parentGroupingField: FieldPath;
}

/**
 * Field mapping configuration
 */
export interface FieldMappingConfig {
  categoryField: FieldPath;
  initiativeField: FieldPath;
  issueItemField: FieldPath;
  multiValueHandling: 'join' | 'first' | 'all';
  multiValueSeparator: string;
}

/**
 * Complete template configuration
 */
export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  userId: string;
  isShared: boolean;
  fieldMapping: FieldMappingConfig;
  issueSelection: IssueSelectionConfig;
  createdAt: string;
  updatedAt: string;
}

/**
 * Common field paths for easy selection
 */
export const COMMON_FIELD_PATHS = [
  { value: 'fields.summary', label: 'Summary' },
  { value: 'key', label: 'Issue Key' },
  { value: 'fields.labels', label: 'Labels' },
  { value: 'fields.assignee.displayName', label: 'Assignee' },
  { value: 'fields.status.name', label: 'Status' },
  { value: 'fields.issuetype.name', label: 'Issue Type' },
  { value: 'fields.parent.fields.summary', label: 'Parent Summary' },
  { value: 'fields.parent.key', label: 'Parent Key' },
];

