import { JiraIssue } from '../types/jira';

/**
 * Find a custom field by name in Jira issue fields
 * Custom fields can be accessed via their ID (customfield_XXXXX) or name
 */
export function findCustomFieldByName(issue: JiraIssue, fieldName: string): any {
  const possibleKeys = Object.keys(issue.fields || {});
  const fieldNameLower = fieldName.toLowerCase();
  
  // If names object is available (from expand=names), use it to find custom fields by name
  if (issue.names) {
    for (const [fieldId, fieldDisplayName] of Object.entries(issue.names)) {
      if (fieldDisplayName && fieldDisplayName.toLowerCase().includes(fieldNameLower)) {
        return issue.fields[fieldId];
      }
    }
  }
  
  // Try direct key matches (case insensitive)
  for (const key of possibleKeys) {
    const keyLower = key.toLowerCase();
    if (keyLower === fieldNameLower || 
        keyLower.replace(/[^a-z0-9]/g, '') === fieldNameLower.replace(/[^a-z0-9]/g, '')) {
      return issue.fields[key];
    }
  }
  
  // Search for field by name in the keys
  for (const key of possibleKeys) {
    if (key.toLowerCase().includes(fieldNameLower)) {
      return issue.fields[key];
    }
  }
  
  return null;
}

/**
 * Extract all relevant fields from a Jira issue
 */
export function extractIssueFields(issue: JiraIssue): {
  assignee?: string | null;
  duedate?: string | null;
  startDate?: string | null;
  confidence?: any;
} {
  const assignee = issue.fields.assignee?.displayName || null;
  const duedate = issue.fields.duedate || null;
  
  // Try to find start date (could be customfield or startdate)
  let startDate: string | null = null;
  const startDateField = findCustomFieldByName(issue, 'start') || 
                        findCustomFieldByName(issue, 'startdate') ||
                        (issue.fields as any).startdate ||
                        (issue.fields as any).customfield_10020; // Common custom field for start date
  if (startDateField && startDateField !== null) {
    if (typeof startDateField === 'string') {
      startDate = startDateField;
    } else if (startDateField.value) {
      startDate = startDateField.value;
    } else if (startDateField.name) {
      startDate = startDateField.name;
    } else {
      startDate = String(startDateField);
    }
  }
  
  // Try to find confidence field - search in all custom fields
  let confidence: any = null;
  const confidenceField = findCustomFieldByName(issue, 'confidence');
  if (confidenceField && confidenceField !== null) {
    confidence = confidenceField;
  } else {
    // Try common confidence custom field IDs
    const fields = issue.fields as any;
    for (const key in fields) {
      if (key.startsWith('customfield_') && 
          (key.toLowerCase().includes('confidence') || 
           (fields[key] && typeof fields[key] === 'object' && fields[key].value && String(fields[key].value).toLowerCase().includes('confidence')))) {
        confidence = fields[key];
        break;
      }
    }
  }
  
  return {
    assignee,
    duedate,
    startDate,
    confidence,
  };
}

