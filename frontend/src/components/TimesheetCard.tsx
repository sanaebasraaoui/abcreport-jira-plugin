import React from 'react';
import { TimesheetSummary } from '../types';
import { normalizeStatusForClass, getStatusCategory } from '../utils/statusUtils';
import './TimesheetCard.css';

interface TimesheetCardProps {
  timesheet: TimesheetSummary;
}

export const TimesheetCard: React.FC<TimesheetCardProps> = ({ timesheet }) => {
  const formatManDays = (manDays: number | undefined | null): string => {
    const validManDays = manDays ?? 0;
    if (isNaN(validManDays) || validManDays === null || validManDays === undefined) {
      return '0d';
    }
    if (validManDays === 0) return '0d';
    
    const isNegative = validManDays < 0;
    const absManDays = Math.abs(validManDays);
    
    // For values less than 1 day (absolute), show as hours
    if (absManDays < 1) {
      const hours = Math.round(absManDays * 8);
      return `${isNegative ? '-' : ''}${hours}h`;
    }
    
    // Calculate whole days and remaining hours
    const wholeDays = Math.floor(absManDays);
    const remainingDays = absManDays - wholeDays;
    const hours = Math.round(remainingDays * 8);
    
    // Format: days and hours if there are hours
    if (hours === 0) {
      return `${isNegative ? '-' : ''}${wholeDays}d`;
    }
    return `${isNegative ? '-' : ''}${wholeDays}d ${hours}h`;
  };

  return (
    <div className="timesheet-card">
      <h3 className="timesheet-title">Global Timesheet</h3>
      
      {/* Parent Timesheet */}
      <div className="timesheet-section">
        <h4 className="timesheet-section-title">Parent Ticket</h4>
        <div className="timesheet-stats">
          <div className="stat-item">
            <span className="stat-label">Time Spent:</span>
            <span className="stat-value primary">{formatManDays(timesheet.parentTimeSpentManDays ?? (timesheet.parentTimeSpentHours ? timesheet.parentTimeSpentHours / 8 : 0))}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Estimate:</span>
            <span className="stat-value">{formatManDays(timesheet.parentTimeEstimateManDays ?? (timesheet.parentTimeEstimateHours ? timesheet.parentTimeEstimateHours / 8 : 0))}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Remaining Time:</span>
            <span className={`stat-value ${((timesheet.parentRemainingManDays ?? (timesheet.parentRemainingHours ? timesheet.parentRemainingHours / 8 : 0)) >= 0) ? 'success' : 'warning'}`}>
              {formatManDays(timesheet.parentRemainingManDays ?? (timesheet.parentRemainingHours ? timesheet.parentRemainingHours / 8 : 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Entries */}
      {timesheet.entries.length > 0 && (
        <div className="timesheet-section">
          <h4 className="timesheet-section-title">Detail by Ticket</h4>
          <div className="timesheet-table-container">
            <table className="timesheet-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Summary</th>
                  <th>Time Spent</th>
                  <th>Estimate</th>
                  <th>Remaining Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {timesheet.entries.map((entry, idx) => (
                  <tr key={idx}>
                    <td className="ticket-key">{entry.issueKey}</td>
                    <td className="ticket-summary">{entry.summary}</td>
                    <td className="time-value">{formatManDays(entry.timespentManDays ?? (entry.timespentHours ? entry.timespentHours / 8 : 0))}</td>
                    <td className="time-value">{formatManDays(entry.timeestimateManDays ?? (entry.timeestimateHours ? entry.timeestimateHours / 8 : 0))}</td>
                    <td className={`time-value ${((entry.remainingManDays ?? (entry.remainingHours ? entry.remainingHours / 8 : 0)) >= 0) ? 'success' : 'warning'}`}>
                      {formatManDays(entry.remainingManDays ?? (entry.remainingHours ? entry.remainingHours / 8 : 0))}
                    </td>
                    <td>
                      <span className={`status-badge status-${normalizeStatusForClass(entry.status)} status-${getStatusCategory(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

