export interface ReportRow {
  category: string;
  initiative: string;
  lastWeek: string[];
  currentWeek: string[];
  nextWeek: string[];
  later: string[];
}

export interface WeekNumbers {
  lastWeek: number;
  currentWeek: number;
  nextWeek: number;
  year: number;
}

export interface ReportData {
  parentIssue: {
    key: string;
    summary: string;
    status: string;
    statusCategory: string;
    issuetype: string;
    labels: string[];
    assignee?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    confidence?: any;
  };
  report: ReportRow[];
  timesheet: TimesheetSummary;
  weekNumbers: WeekNumbers;
  childrenCount: number;
}

export interface IssueSuggestion {
  key: string;
  summary: string;
  issuetype: string;
}

export interface TimesheetEntry {
  issueKey: string;
  summary: string;
  timespent: number;
  timeestimate: number;
  timespentHours: number;
  timeestimateHours: number;
  remainingHours: number;
  timespentManDays: number;
  timeestimateManDays: number;
  remainingManDays: number;
  status: string;
}

export interface TimesheetSummary {
  totalTimeSpent: number;
  totalTimeSpentHours: number;
  totalTimeSpentManDays: number;
  totalTimeEstimate: number;
  totalTimeEstimateHours: number;
  totalTimeEstimateManDays: number;
  remainingHours: number;
  remainingManDays: number;
  entries: TimesheetEntry[];
  parentTimeSpent: number;
  parentTimeSpentHours: number;
  parentTimeSpentManDays: number;
  parentTimeEstimate: number;
  parentTimeEstimateHours: number;
  parentTimeEstimateManDays: number;
  parentRemainingHours: number;
  parentRemainingManDays: number;
}

