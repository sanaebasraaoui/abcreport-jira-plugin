import { JiraIssue, IssueSection } from '../types/jira';
import { ReportTemplate, FieldMappingConfig, IssueSelectionConfig, DEFAULT_TEMPLATE } from '../types/template';
import { extractFieldValue, formatFieldValue, getFieldDisplayValue } from '../utils/fieldExtractor';

export interface ReportRow {
  category: string;
  initiative: string;
  lastWeek: string[];
  currentWeek: string[];
  nextWeek: string[];
  later: string[];
}

/**
 * Report Service
 * 
 * Generates weekly reports from Jira issues.
 * Supports customizable field mappings via templates.
 */
export class ReportService {
  private categorizeIssue(statusName: string): IssueSection {
    const statusLower = statusName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove accents for comparison
    
    // Map Jira statuses to sections (English and French)
    // Done/Finished/Completed statuses -> Last Week
    if (
      statusLower.includes('done') || 
      statusLower.includes('closed') || 
      statusLower.includes('resolved') ||
      statusLower.includes('termine') ||  // Terminé(e) in French
      statusLower.includes('fini') ||     // Fini in French
      statusLower.includes('complete') ||
      statusLower.includes('resolu')      // Résolu in French
    ) {
      return IssueSection.LAST_WEEK;
    } 
    // In Progress/In Development statuses -> Current Week
    else if (
      statusLower.includes('in progress') || 
      statusLower.includes('in development') || 
      statusLower.includes('testing') ||
      statusLower.includes('en cours') ||      // En cours in French
      statusLower.includes('en developpement') || // En développement in French
      statusLower.includes('en test') ||       // En test in French
      statusLower.includes('en revue') ||      // En revue (In Review) in French
      statusLower.includes('code review') ||
      statusLower.includes('review')
    ) {
      return IssueSection.CURRENT_WEEK;
    } 
    // To Do/Open/Ready statuses -> Next Week
    else if (
      statusLower.includes('to do') || 
      statusLower.includes('open') || 
      statusLower.includes('ready') ||
      statusLower.includes('a faire') ||       // À faire in French
      statusLower.includes('a realiser') ||    // À réaliser in French
      statusLower.includes('nouveau') ||       // Nouveau (New) in French
      statusLower.includes('nouvelle') ||      // Nouvelle (New) in French
      statusLower.includes('pret') ||          // Prêt (Ready) in French
      statusLower.includes('backlog')
    ) {
      return IssueSection.NEXT_WEEK;
    } 
    // All other statuses -> Later
    else {
      return IssueSection.LATER;
    }
  }

  /**
   * Generate report using template configuration
   * 
   * @param issues - Array of Jira issues
   * @param template - Template configuration (optional, uses default if not provided)
   * @returns Array of report rows
   */
  generateReport(issues: JiraIssue[], template?: Partial<ReportTemplate>): ReportRow[] {
    // Use provided template or default
    const fieldMapping: FieldMappingConfig = template?.fieldMapping || DEFAULT_TEMPLATE.fieldMapping;
    const issueSelection: IssueSelectionConfig = template?.issueSelection || DEFAULT_TEMPLATE.issueSelection;

    // Get all child issues (including nested if configured)
    const allIssues = this.getIssuesWithDepth(issues, issueSelection);

    // Group issues by parent
    const groupedByParent = this.groupIssuesByParent(allIssues, issueSelection.parentGroupingField);

    // Convert to report rows
    const reportRows: ReportRow[] = [];

    groupedByParent.forEach((childIssues, parentKey) => {
      // Get parent issue (use first child's parent)
      const parentIssue = childIssues[0].fields.parent;
      
      // Extract category from parent issue using template field mapping
      const category = parentIssue
        ? getFieldDisplayValue(
            { ...parentIssue, fields: parentIssue.fields || {} } as JiraIssue,
            fieldMapping.categoryField,
            { fallback: 'Uncategorized' }
          )
        : 'Uncategorized';

      // Group by initiative field
      const groupedByInitiative = this.groupIssuesByField(
        childIssues,
        fieldMapping.initiativeField,
        fieldMapping.multiValueHandling,
        fieldMapping.multiValueSeparator
      );

      // Create rows for each initiative group
      groupedByInitiative.forEach((groupIssues, initiativeValue) => {
        const row: ReportRow = {
          category,
          initiative: initiativeValue || 'No initiative',
          lastWeek: [],
          currentWeek: [],
          nextWeek: [],
          later: [],
        };

        groupIssues.forEach(issue => {
          const section = this.categorizeIssue(issue.fields.status.name);
          
          // Extract issue item value using template field mapping
          const issueItem = getFieldDisplayValue(
            issue,
            fieldMapping.issueItemField,
            {
              multiValueHandling: 'join',
              separator: ', ',
              fallback: issue.key,
            }
          );
          
          switch (section) {
            case IssueSection.LAST_WEEK:
              row.lastWeek.push(issueItem);
              break;
            case IssueSection.CURRENT_WEEK:
              row.currentWeek.push(issueItem);
              break;
            case IssueSection.NEXT_WEEK:
              row.nextWeek.push(issueItem);
              break;
            case IssueSection.LATER:
              row.later.push(issueItem);
              break;
          }
        });

        reportRows.push(row);
      });
    });

    return reportRows;
  }

  /**
   * Get issues with configured depth (for nested children support)
   * 
   * @param issues - Initial issues array
   * @param selectionConfig - Issue selection configuration
   * @returns All issues including nested children up to max depth
   */
  private getIssuesWithDepth(
    issues: JiraIssue[],
    selectionConfig: IssueSelectionConfig
  ): JiraIssue[] {
    if (!selectionConfig.includeNestedChildren || selectionConfig.maxDepth <= 1) {
      return issues;
    }

    // For now, return original issues
    // TODO: Implement nested children fetching (would need to fetch children of children)
    // This requires additional API calls to get children of each child issue
    return issues;
  }

  /**
   * Group issues by parent using custom field path
   * 
   * @param issues - Issues to group
   * @param parentGroupingField - Field path for parent grouping (e.g., "fields.parent.key")
   * @returns Map of parent key to child issues array
   */
  private groupIssuesByParent(
    issues: JiraIssue[],
    parentGroupingField: string
  ): Map<string, JiraIssue[]> {
    const groupedByParent = new Map<string, JiraIssue[]>();

    issues.forEach(issue => {
      const parentKey = extractFieldValue(issue, parentGroupingField) || 'UNPARENTED';
      
      if (!groupedByParent.has(parentKey)) {
        groupedByParent.set(parentKey, []);
      }
      groupedByParent.get(parentKey)!.push(issue);
    });

    return groupedByParent;
  }

  /**
   * Group issues by a specific field value
   * 
   * @param issues - Issues to group
   * @param fieldPath - Field path to group by
   * @param multiValueHandling - How to handle multi-value fields
   * @param separator - Separator for joining multi-value fields
   * @returns Map of field value to issues array
   */
  private groupIssuesByField(
    issues: JiraIssue[],
    fieldPath: string,
    multiValueHandling: 'join' | 'first' | 'all',
    separator: string
  ): Map<string, JiraIssue[]> {
    const grouped = new Map<string, JiraIssue[]>();

    issues.forEach(issue => {
      const fieldValue = extractFieldValue(issue, fieldPath);
      const formattedValue = formatFieldValue(fieldValue, {
        multiValueHandling,
        separator,
        fallback: 'No value',
      });

      // Handle "all" multi-value: create separate groups for each value
      if (multiValueHandling === 'all' && Array.isArray(fieldValue) && fieldValue.length > 0) {
        fieldValue.forEach(value => {
          const formatted = formatFieldValue(value, { fallback: 'No value' });
          const key = formatted || 'No value';
          
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key)!.push(issue);
        });
      } else {
        // Single value or joined
        const key = formattedValue || 'No value';
        
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(issue);
      }
    });

    return grouped;
  }
}

