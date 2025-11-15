/**
 * Template Types
 * 
 * Types for report template configuration and storage.
 * Templates allow users to customize which fields map to which columns in the report.
 */

/**
 * Field path type for accessing nested issue fields
 * 
 * Examples:
 * - "summary" - direct field
 * - "fields.summary" - explicit path
 * - "fields.parent.fields.summary" - nested parent field
 * - "fields.assignee.displayName" - nested object field
 * - "customfield_12345" - custom field ID
 */
export type FieldPath = string;

/**
 * Issue selection configuration
 * Controls which issues are included in the report
 */
export interface IssueSelectionConfig {
  /**
   * Maximum depth for nested child issues
   * 1 = only direct children, 2 = children and grandchildren, etc.
   * 0 = unlimited depth (default)
   */
  maxDepth: number;
  
  /**
   * Whether to include nested children at all
   */
  includeNestedChildren: boolean;
  
  /**
   * Field path to use for grouping issues by parent
   * Default: "fields.parent.key"
   */
  parentGroupingField: FieldPath;
}

/**
 * Field mapping configuration
 * Defines which fields are used for each column in the report
 */
export interface FieldMappingConfig {
  /**
   * Field path for Category column
   * This field will be extracted from the parent issue
   * Default: "fields.parent.fields.summary"
   */
  categoryField: FieldPath;
  
  /**
   * Field path for Initiative column
   * This field will be extracted from child issues
   * Default: "fields.labels" (will be joined)
   */
  initiativeField: FieldPath;
  
  /**
   * Field path for Issue Items (what appears in Last Week, Current Week, etc.)
   * This field will be extracted from child issues
   * Default: "fields.summary"
   */
  issueItemField: FieldPath;
  
  /**
   * How to handle multi-value fields (like labels)
   * "join" = join with separator, "first" = take first value, "all" = create separate rows
   */
  multiValueHandling: 'join' | 'first' | 'all';
  
  /**
   * Separator for joining multi-value fields
   * Default: ", "
   */
  multiValueSeparator: string;
}

/**
 * Complete template configuration
 */
export interface ReportTemplate {
  /**
   * Unique template ID
   */
  id: string;
  
  /**
   * Template name (user-friendly)
   */
  name: string;
  
  /**
   * Template description
   */
  description?: string;
  
  /**
   * User/creator identifier
   * For Connect mode: user account ID from Jira
   * For standalone mode: user email or session ID
   */
  userId: string;
  
  /**
   * Whether this template is shared/public
   */
  isShared: boolean;
  
  /**
   * Field mapping configuration
   */
  fieldMapping: FieldMappingConfig;
  
  /**
   * Issue selection configuration
   */
  issueSelection: IssueSelectionConfig;
  
  /**
   * Creation timestamp
   */
  createdAt: string;
  
  /**
   * Last modification timestamp
   */
  updatedAt: string;
}

/**
 * Default template configuration
 * Matches the current hardcoded behavior
 */
export const DEFAULT_TEMPLATE: Omit<ReportTemplate, 'id' | 'name' | 'userId' | 'createdAt' | 'updatedAt'> = {
  description: 'Default template matching original behavior',
  isShared: false,
  fieldMapping: {
    categoryField: 'fields.parent.fields.summary',
    initiativeField: 'fields.labels',
    issueItemField: 'fields.summary',
    multiValueHandling: 'join',
    multiValueSeparator: ', ',
  },
  issueSelection: {
    maxDepth: 1,
    includeNestedChildren: false,
    parentGroupingField: 'fields.parent.key',
  },
};

