import { JiraIssue } from '../types/jira';

export interface TimesheetEntry {
  issueKey: string;
  summary: string;
  timespent: number; // in seconds
  timeestimate: number; // in seconds
  timespentHours: number;
  timeestimateHours: number;
  remainingHours: number;
  timespentManDays: number; // in man days (8 hours = 1 day)
  timeestimateManDays: number;
  remainingManDays: number;
  status: string;
}

export interface TimesheetSummary {
  totalTimeSpent: number; // in seconds
  totalTimeSpentHours: number;
  totalTimeSpentManDays: number; // in man days
  totalTimeEstimate: number; // in seconds
  totalTimeEstimateHours: number;
  totalTimeEstimateManDays: number; // in man days
  remainingHours: number;
  remainingManDays: number; // in man days
  entries: TimesheetEntry[];
  parentTimeSpent: number;
  parentTimeSpentHours: number;
  parentTimeSpentManDays: number; // in man days
  parentTimeEstimate: number;
  parentTimeEstimateHours: number;
  parentTimeEstimateManDays: number; // in man days
  parentRemainingHours: number;
  parentRemainingManDays: number; // in man days
}

export class TimesheetService {
  private secondsToHours(seconds: number): number {
    if (!seconds || isNaN(seconds) || seconds === null || seconds === undefined || typeof seconds !== 'number') {
      return 0;
    }
    const hours = Number((seconds / 3600).toFixed(2));
    return isNaN(hours) ? 0 : hours;
  }

  private hoursToManDays(hours: number): number {
    if (!hours || isNaN(hours) || hours === null || hours === undefined) {
      return 0;
    }
    // 1 man day = 8 hours
    return Number((hours / 8).toFixed(2));
  }

  private formatHours(hours: number): string {
    if (hours === 0) return '0h';
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h${minutes}m`;
  }

  generateTimesheet(parentIssue: JiraIssue, children: JiraIssue[]): TimesheetSummary {
    const entries: TimesheetEntry[] = [];
    
    // Process parent issue
    const parentTimeSpent = parentIssue.fields.aggregatetimespent || parentIssue.fields.timespent || 0;
    const parentTimeEstimate = parentIssue.fields.aggregatetimeestimate || parentIssue.fields.timeestimate || 0;

    // Process children
    let totalTimeSpent = 0;
    let totalTimeEstimate = 0;

    children.forEach(issue => {
      const timespent = issue.fields.timespent || 0;
      const timeestimate = issue.fields.timeestimate || 0;
      
      totalTimeSpent += timespent;
      totalTimeEstimate += timeestimate;

      const timespentHours = this.secondsToHours(timespent);
      const timeestimateHours = this.secondsToHours(timeestimate);
      const remainingHours = isNaN(timeestimateHours) || isNaN(timespentHours)
        ? 0
        : (timeestimateHours || 0) - (timespentHours || 0);

      const timespentManDays = this.hoursToManDays(timespentHours);
      const timeestimateManDays = this.hoursToManDays(timeestimateHours);
      const remainingManDays = this.hoursToManDays(remainingHours);

      entries.push({
        issueKey: issue.key,
        summary: issue.fields.summary,
        timespent,
        timeestimate,
        timespentHours: isNaN(timespentHours) ? 0 : timespentHours,
        timeestimateHours: isNaN(timeestimateHours) ? 0 : timeestimateHours,
        remainingHours: isNaN(remainingHours) ? 0 : remainingHours,
        timespentManDays: isNaN(timespentManDays) ? 0 : timespentManDays,
        timeestimateManDays: isNaN(timeestimateManDays) ? 0 : timeestimateManDays,
        remainingManDays: isNaN(remainingManDays) ? 0 : remainingManDays,
        status: issue.fields.status.name,
      });
    });

    const totalTimeSpentHours = this.secondsToHours(totalTimeSpent);
    const totalTimeEstimateHours = this.secondsToHours(totalTimeEstimate);
    const remainingHours = isNaN(totalTimeEstimateHours) || isNaN(totalTimeSpentHours)
      ? 0
      : (totalTimeEstimateHours || 0) - (totalTimeSpentHours || 0);

    const parentTimeSpentHours = this.secondsToHours(parentTimeSpent);
    const parentTimeEstimateHours = this.secondsToHours(parentTimeEstimate);
    const parentRemainingHours = isNaN(parentTimeEstimateHours) || isNaN(parentTimeSpentHours)
      ? 0
      : (parentTimeEstimateHours || 0) - (parentTimeSpentHours || 0);

    // Convert to man days (8 hours = 1 day)
    const totalTimeSpentManDays = this.hoursToManDays(totalTimeSpentHours);
    const totalTimeEstimateManDays = this.hoursToManDays(totalTimeEstimateHours);
    const remainingManDays = this.hoursToManDays(remainingHours);
    const parentTimeSpentManDays = this.hoursToManDays(parentTimeSpentHours);
    const parentTimeEstimateManDays = this.hoursToManDays(parentTimeEstimateHours);
    const parentRemainingManDays = this.hoursToManDays(parentRemainingHours);

    return {
      totalTimeSpent,
      totalTimeSpentHours: isNaN(totalTimeSpentHours) ? 0 : totalTimeSpentHours,
      totalTimeSpentManDays: isNaN(totalTimeSpentManDays) ? 0 : totalTimeSpentManDays,
      totalTimeEstimate,
      totalTimeEstimateHours: isNaN(totalTimeEstimateHours) ? 0 : totalTimeEstimateHours,
      totalTimeEstimateManDays: isNaN(totalTimeEstimateManDays) ? 0 : totalTimeEstimateManDays,
      remainingHours: isNaN(remainingHours) ? 0 : remainingHours,
      remainingManDays: isNaN(remainingManDays) ? 0 : remainingManDays,
      entries,
      parentTimeSpent,
      parentTimeSpentHours: isNaN(parentTimeSpentHours) ? 0 : parentTimeSpentHours,
      parentTimeSpentManDays: isNaN(parentTimeSpentManDays) ? 0 : parentTimeSpentManDays,
      parentTimeEstimate,
      parentTimeEstimateHours: isNaN(parentTimeEstimateHours) ? 0 : parentTimeEstimateHours,
      parentTimeEstimateManDays: isNaN(parentTimeEstimateManDays) ? 0 : parentTimeEstimateManDays,
      parentRemainingHours: isNaN(parentRemainingHours) ? 0 : parentRemainingHours,
      parentRemainingManDays: isNaN(parentRemainingManDays) ? 0 : parentRemainingManDays,
    };
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0h';
    const hours = this.secondsToHours(seconds);
    return this.formatHours(hours);
  }
}

