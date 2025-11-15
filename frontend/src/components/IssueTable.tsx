import React from 'react';
import { ReportRow, WeekNumbers } from '../types';
import './IssueTable.css';

interface IssueTableProps {
  rows: ReportRow[];
  weekNumbers?: WeekNumbers;
}

export const IssueTable: React.FC<IssueTableProps> = ({ rows, weekNumbers }) => {
  const formatList = (items: string[]) => {
    if (items.length === 0) return '-';
    return items.map((item, index) => (
      <div key={index} className="issue-item">{item}</div>
    ));
  };

  // Use provided week numbers or calculate them
  const getWeekNumbers = (): WeekNumbers => {
    if (weekNumbers) return weekNumbers;
    
    // Calculate ISO week numbers on client side if not provided
    const now = new Date();
    const getISOWeek = (date: Date): number => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    const currentWeek = getISOWeek(now);
    const lastWeekDate = new Date(now);
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const lastWeek = getISOWeek(lastWeekDate);
    const nextWeekDate = new Date(now);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeek = getISOWeek(nextWeekDate);

    return { lastWeek, currentWeek, nextWeek, year: now.getFullYear() };
  };

  const weeks = getWeekNumbers();

  return (
    <div className="table-container">
      <table className="issue-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Initiative</th>
            <th>Last week (Week {weeks.lastWeek})</th>
            <th>Current Week (Week {weeks.currentWeek})</th>
            <th>Next Week (Week {weeks.nextWeek})</th>
            <th>Later</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{row.category}</td>
              <td>{row.initiative}</td>
              <td>{formatList(row.lastWeek)}</td>
              <td>{formatList(row.currentWeek)}</td>
              <td>{formatList(row.nextWeek)}</td>
              <td>{formatList(row.later)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

