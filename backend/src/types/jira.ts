export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  status: {
    name: string;
    statusCategory: {
      key: string;
      name: string;
    };
  };
  labels: string[];
  issueType: {
    name: string;
  };
  parent?: {
    key: string;
    summary: string;
  };
  names?: {
    [key: string]: string; // Maps field IDs to field names (e.g., "customfield_10020": "Start Date")
  };
  fields: {
    summary: string;
    status: {
      name: string;
      statusCategory: {
        key: string;
        name: string;
      };
    };
    labels: string[];
    issuetype: {
      name: string;
    };
    parent?: {
      key: string;
      fields: {
        summary: string;
      };
    };
    timespent?: number; // seconds
    timeestimate?: number; // seconds
    aggregatetimespent?: number; // seconds
    aggregatetimeestimate?: number; // seconds
    worklog?: {
      maxResults: number;
      total: number;
      worklogs: Array<{
        timeSpentSeconds: number;
        started: string;
        author: {
          displayName: string;
          emailAddress: string;
        };
        comment?: string;
      }>;
    };
    assignee?: {
      displayName: string;
      emailAddress?: string;
      accountId?: string;
    } | null;
    duedate?: string; // ISO date string for end date
    [key: string]: any; // For custom fields like confidence, start date
  };
}

export interface JiraResponse {
  issues: JiraIssue[];
  total: number;
}

export interface IssueChildrenResponse {
  issues: Array<{
    key: string;
    fields: {
      summary: string;
      status: {
        name: string;
        statusCategory: {
          key: string;
        };
      };
      labels: string[];
      parent?: {
        key: string;
        fields: {
          summary: string;
        };
      };
    };
  }>;
}

export enum IssueSection {
  LAST_WEEK = 'Last week',
  CURRENT_WEEK = 'Current week',
  NEXT_WEEK = 'Next week',
  LATER = 'Later',
}

