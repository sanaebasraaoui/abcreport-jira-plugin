import PptxGenJS from 'pptxgenjs';
import { ReportRow } from './reportService';
import { JiraIssue } from '../types/jira';
import { TimesheetSummary } from './timesheetService';
import { getWeekNumbers } from '../utils/weekUtils';
import { extractIssueFields } from '../utils/jiraFieldUtils';

export class PptExportService {
  private formatManDays(manDays: number | undefined | null): string {
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
  }

  async generatePresentation(reportRows: ReportRow[], issue: JiraIssue, timesheet: TimesheetSummary): Promise<Buffer> {
    const weekNumbers = getWeekNumbers();
    const additionalFields = extractIssueFields(issue);
    
    const pptx = new PptxGenJS();
    
    // Set layout to widescreen 16:9
    pptx.layout = 'LAYOUT_WIDE' as any;
    
    // Define blue color scheme
    const bluePrimary = '0052CC';
    const blueLight = 'DEEBFF';
    const blueVeryLight = 'E3F0FF';
    const darkText = '172B4D';
    const greyText = '6B778C';
    
    const issueKey = issue.key;
    const issueSummary = issue.fields.summary;
    const issueStatus = issue.fields.status.name;
    const issueType = issue.fields.issuetype?.name || 'Unknown';
    const issueLabels = issue.fields.labels || [];
    
    // ============================================
    // SLIDE 1: Weekly Report
    // ============================================
    const slide1 = pptx.addSlide();
    
    // Title
    slide1.addText('ABC Manager - Weekly Report', {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.5,
      fontSize: 32,
      bold: true,
      color: bluePrimary,
      align: 'left',
    });
    
    // Parent Issue Information
    slide1.addText(`Ticket: ${issueKey}`, {
      x: 0.5,
      y: 1,
      w: 9,
      h: 0.3,
      fontSize: 20,
      bold: true,
      color: darkText,
      align: 'left',
    });
    
    slide1.addText(`Summary: ${issueSummary}`, {
      x: 0.5,
      y: 1.4,
      w: 9,
      h: 0.3,
      fontSize: 16,
      color: darkText,
      align: 'left',
    });
    
    // Issue details as text
    const detailsText = [
      `Type: ${issueType}`,
      additionalFields.assignee ? `Assignee: ${additionalFields.assignee}` : null,
      additionalFields.startDate ? `Start Date: ${new Date(additionalFields.startDate).toLocaleDateString()}` : null,
      additionalFields.duedate ? `End Date: ${new Date(additionalFields.duedate).toLocaleDateString()}` : null,
      `Status: ${issueStatus}`,
      issueLabels.length > 0 ? `Labels: ${issueLabels.join(', ')}` : null,
      `Children: ${reportRows.reduce((sum, row) => sum + row.lastWeek.length + row.currentWeek.length + row.nextWeek.length + row.later.length, 0)}`,
    ].filter(Boolean).join(' | ');
    
    slide1.addText(detailsText, {
      x: 0.5,
      y: 1.8,
      w: 9,
      h: 0.4,
      fontSize: 12,
      color: greyText,
      align: 'left',
    });
    
    // Weekly Report Table Title
    slide1.addText('Weekly Report', {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 0.3,
      fontSize: 24,
      bold: true,
      color: darkText,
      align: 'left',
    });
    
    // Build table data
    const tableData: any[] = [
      [
        { text: 'Category', options: { bold: true, color: bluePrimary, fill: { color: blueLight } } },
        { text: 'Initiative', options: { bold: true, color: bluePrimary, fill: { color: blueLight } } },
        { text: `Last week (Week ${weekNumbers.lastWeek})`, options: { bold: true, color: bluePrimary, fill: { color: blueLight } } },
        { text: `Current Week (Week ${weekNumbers.currentWeek})`, options: { bold: true, color: bluePrimary, fill: { color: blueLight } } },
        { text: `Next Week (Week ${weekNumbers.nextWeek})`, options: { bold: true, color: bluePrimary, fill: { color: blueLight } } },
        { text: 'Later', options: { bold: true, color: bluePrimary, fill: { color: blueLight } } },
      ],
    ];
    
    // Add data rows
    reportRows.forEach((row, index) => {
      const isEven = index % 2 === 0;
      tableData.push([
        { text: row.category, options: { color: darkText, fill: { color: isEven ? blueVeryLight : 'FFFFFF' } } },
        { text: row.initiative, options: { color: darkText, fill: { color: isEven ? blueVeryLight : 'FFFFFF' } } },
        { 
          text: row.lastWeek.length > 0 ? `• ${row.lastWeek.join('\n• ')}` : '-', 
          options: { color: darkText, fill: { color: isEven ? blueVeryLight : 'FFFFFF' }, valign: 'top' } 
        },
        { 
          text: row.currentWeek.length > 0 ? `• ${row.currentWeek.join('\n• ')}` : '-', 
          options: { color: darkText, fill: { color: isEven ? blueVeryLight : 'FFFFFF' }, valign: 'top' } 
        },
        { 
          text: row.nextWeek.length > 0 ? `• ${row.nextWeek.join('\n• ')}` : '-', 
          options: { color: darkText, fill: { color: isEven ? blueVeryLight : 'FFFFFF' }, valign: 'top' } 
        },
        { 
          text: row.later.length > 0 ? `• ${row.later.join('\n• ')}` : '-', 
          options: { color: darkText, fill: { color: isEven ? blueVeryLight : 'FFFFFF' }, valign: 'top' } 
        },
      ]);
    });
    
    // Add table
    slide1.addTable(tableData, {
      x: 0.5,
      y: 2.9,
      w: 9,
      h: reportRows.length > 0 ? Math.min(3.5, 0.3 + reportRows.length * 0.4) : 1,
      colW: [1.8, 1.8, 1.35, 1.35, 1.35, 1.35],
      border: { type: 'solid', color: bluePrimary, pt: 1 },
      align: 'left',
      valign: 'top',
    });
    
    // ============================================
    // SLIDE 2: Global Timesheet
    // ============================================
    const slide2 = pptx.addSlide();
    
    // Title with blue underline
    slide2.addText('Global Timesheet', {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.5,
      fontSize: 32,
      bold: true,
      color: darkText,
      align: 'left',
    });
    
    // Blue underline (using a line shape)
    slide2.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y: 0.75,
      w: 3,
      h: 0.05,
      fill: { color: bluePrimary },
      line: { color: bluePrimary },
    } as any);
    
    // Parent Ticket Section
    slide2.addText('Parent Ticket', {
      x: 0.5,
      y: 1.2,
      w: 4,
      h: 0.3,
      fontSize: 20,
      bold: true,
      color: greyText,
      align: 'left',
    });
    
    const parentTableData = [
      [
        { text: 'Parent Ticket', options: { bold: true, color: bluePrimary, fill: { color: blueLight } } },
        { text: 'Time Spent', options: { bold: true, color: bluePrimary, fill: { color: blueLight } } },
        { text: 'Estimate', options: { bold: true, color: bluePrimary, fill: { color: blueLight } } },
        { text: 'Remaining Time', options: { bold: true, color: bluePrimary, fill: { color: blueLight } } },
      ],
      [
        { text: `${issueKey}: ${issueSummary}`, options: { color: darkText } },
        { text: this.formatManDays(timesheet.parentTimeSpentManDays), options: { color: bluePrimary, bold: true } },
        { text: this.formatManDays(timesheet.parentTimeEstimateManDays), options: { color: darkText } },
        { 
          text: this.formatManDays(timesheet.parentRemainingManDays ?? 0), 
          options: { color: (timesheet.parentRemainingManDays ?? 0) >= 0 ? '006644' : 'FF991F', bold: true } 
        },
      ],
    ];
    
    slide2.addTable(parentTableData, {
      x: 0.5,
      y: 1.6,
      w: 9,
      h: 0.8,
      colW: [3.6, 1.8, 1.8, 1.8],
      border: { type: 'solid', color: bluePrimary, pt: 1 },
    });
    
    // Detail by Ticket Table (if entries exist)
    if (timesheet.entries.length > 0) {
      slide2.addText('Detail by Ticket', {
        x: 0.5,
        y: 2.8,
        w: 9,
        h: 0.3,
        fontSize: 20,
        bold: true,
        color: darkText,
        align: 'left',
      });
      
      const detailTableData: any[] = [
        [
          { text: 'Ticket', options: { bold: true, color: bluePrimary, fill: { color: blueLight }, fontSize: 10 } },
          { text: 'Summary', options: { bold: true, color: bluePrimary, fill: { color: blueLight }, fontSize: 10 } },
          { text: 'Time Spent', options: { bold: true, color: bluePrimary, fill: { color: blueLight }, fontSize: 10 } },
          { text: 'Estimate', options: { bold: true, color: bluePrimary, fill: { color: blueLight }, fontSize: 10 } },
          { text: 'Remaining Time', options: { bold: true, color: bluePrimary, fill: { color: blueLight }, fontSize: 10 } },
          { text: 'Status', options: { bold: true, color: bluePrimary, fill: { color: blueLight }, fontSize: 10 } },
        ],
      ];
      
      timesheet.entries.forEach((entry, index) => {
        const isEven = index % 2 === 0;
        detailTableData.push([
          { text: entry.issueKey, options: { color: bluePrimary, bold: true, fill: { color: isEven ? blueVeryLight : 'FFFFFF' }, fontSize: 9 } },
          { text: entry.summary, options: { color: darkText, fill: { color: isEven ? blueVeryLight : 'FFFFFF' }, fontSize: 9 } },
          { text: this.formatManDays(entry.timespentManDays), options: { color: darkText, fill: { color: isEven ? blueVeryLight : 'FFFFFF' }, fontSize: 9 } },
          { text: this.formatManDays(entry.timeestimateManDays), options: { color: darkText, fill: { color: isEven ? blueVeryLight : 'FFFFFF' }, fontSize: 9 } },
          { 
            text: this.formatManDays(entry.remainingManDays ?? 0), 
            options: { 
              color: (entry.remainingManDays ?? 0) >= 0 ? '006644' : 'FF991F', 
              bold: true,
              fill: { color: isEven ? blueVeryLight : 'FFFFFF' }, 
              fontSize: 9 
            } 
          },
          { text: entry.status, options: { color: darkText, fill: { color: isEven ? blueVeryLight : 'FFFFFF' }, fontSize: 9 } },
        ]);
      });
      
      slide2.addTable(detailTableData, {
        x: 0.5,
        y: 3.2,
        w: 9,
        h: Math.min(3.5, 0.5 + timesheet.entries.length * 0.3),
        colW: [1.0, 3.0, 1.0, 1.0, 1.2, 1.8],
        border: { type: 'solid', color: bluePrimary, pt: 1 },
        fontSize: 9,
      });
    }
    
    // Generate buffer
    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    return buffer as Buffer;
  }
}

