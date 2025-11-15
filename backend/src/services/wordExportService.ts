import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, HeadingLevel, Spacing, BorderStyle, ShadingType, TableCellBorders, VerticalAlign, PageOrientation } from 'docx';
import { ReportRow } from './reportService';
import { JiraIssue } from '../types/jira';
import { TimesheetSummary } from './timesheetService';
import { getWeekNumbers } from '../utils/weekUtils';
import { extractIssueFields } from '../utils/jiraFieldUtils';

// Helper to create styled table borders (blue instead of grey)
const createTableBorders = () => ({
  top: { style: BorderStyle.SINGLE, size: 1, color: "0052CC" }, // Blue borders
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "0052CC" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "0052CC" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "0052CC" },
});

// Helper to create header cell with styling (blue instead of grey)
const createHeaderCell = (text: string, widthPercent: number, useBlueAccent: boolean = false): TableCell => {
  return new TableCell({
    children: [new Paragraph({ 
      children: [new TextRun({ 
        text, 
        bold: true,
        color: "0052CC", // Blue text for all headers
        size: 24,
      })],
      spacing: { before: 200, after: 200 },
    })],
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: {
      type: ShadingType.SOLID,
      color: "DEEBFF", // Light blue background instead of grey
    },
    margins: {
      top: 227, // ~12px
      bottom: 227,
      left: 227,
      right: 227,
    },
    borders: {
      ...createTableBorders(),
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" }, // Blue border
    },
  });
};

// Helper to create data cell with styling
const createDataCell = (content: string | Paragraph[], isEven: boolean = false, isBlue: boolean = false): TableCell => {
  let children: Paragraph[];
  
  if (Array.isArray(content)) {
    children = content;
  } else {
    children = [new Paragraph({ 
      children: [
        new TextRun({ 
          text: content, 
          color: isBlue ? "0052CC" : "172B4D", // Blue for ticket keys, dark for others
          bold: isBlue, // Bold for ticket keys
          font: isBlue ? "Courier New" : undefined, // Monospace for ticket keys like web page
        })
      ],
      spacing: { before: 200, after: 200 } 
    })];
  }
  
  return new TableCell({
    children,
    margins: {
      top: 227,
      bottom: 227,
      left: 227,
      right: 227,
    },
    shading: isEven ? {
      type: ShadingType.SOLID,
      color: "E3F0FF", // Light blue instead of light grey for alternating rows
    } : undefined,
    borders: createTableBorders(),
    verticalAlign: VerticalAlign.TOP,
  });
};

// Helper to create data cell with bullet points for lists
const createBulletListCell = (items: string[], isEven: boolean = false): TableCell => {
  if (items.length === 0) {
    return createDataCell('-', isEven);
  }

  const paragraphs: Paragraph[] = items.map((item, index) => {
    return new Paragraph({
      children: [
        new TextRun({
          text: item,
          color: "172B4D",
        }),
      ],
      bullet: {
        level: 0, // Level 0 for first level bullets
      },
      spacing: { before: 100, after: 100 },
    });
  });

  return new TableCell({
    children: paragraphs,
    margins: {
      top: 227,
      bottom: 227,
      left: 227,
      right: 227,
    },
    shading: isEven ? {
      type: ShadingType.SOLID,
      color: "E3F0FF", // Light blue instead of light grey for alternating rows
    } : undefined,
    borders: createTableBorders(),
    verticalAlign: VerticalAlign.TOP,
  });
};

export class WordExportService {
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

  async generateDocument(reportRows: ReportRow[], issue: JiraIssue, timesheet: TimesheetSummary): Promise<Buffer> {
    const weekNumbers = getWeekNumbers();
    const additionalFields = extractIssueFields(issue);
    
    const tableRows: TableRow[] = [
      // Header row
      new TableRow({
        children: [
          createHeaderCell('Category', 20),
          createHeaderCell('Initiative', 20),
          createHeaderCell(`Last week (Week ${weekNumbers.lastWeek})`, 15),
          createHeaderCell(`Current Week (Week ${weekNumbers.currentWeek})`, 15),
          createHeaderCell(`Next Week (Week ${weekNumbers.nextWeek})`, 15),
          createHeaderCell('Later', 15),
        ],
      }),
    ];

    // Data rows with alternating colors and bullet points
    reportRows.forEach((row, index) => {
      const isEven = index % 2 === 0;
      tableRows.push(
        new TableRow({
          children: [
            createDataCell(row.category, isEven),
            createDataCell(row.initiative, isEven),
            createBulletListCell(row.lastWeek, isEven),
            createBulletListCell(row.currentWeek, isEven),
            createBulletListCell(row.nextWeek, isEven),
            createBulletListCell(row.later, isEven),
          ],
        })
      );
    });

    const table = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      },
    });

    const issueKey = issue.key;
    const issueSummary = issue.fields.summary;
    const issueStatus = issue.fields.status.name;
    const issueType = issue.fields.issuetype?.name || 'Unknown';
    const issueLabels = issue.fields.labels || [];

    // Helper for detail rows
    const createDetailRow = (label: string, value: string, isEven: boolean = false): TableRow => {
      return new TableRow({
        children: [
          createDataCell([new Paragraph({ children: [new TextRun({ text: label, bold: true })] })], isEven),
          createDataCell(value, isEven),
        ],
      });
    };

    // Build issue details table rows
    const detailsRows: TableRow[] = [
      createDetailRow('Type:', issueType, false),
    ];

    let rowIndex = 1;

    // Add Confidence if available
    if (additionalFields.confidence !== null && additionalFields.confidence !== undefined) {
      const confidenceValue = typeof additionalFields.confidence === 'object'
        ? additionalFields.confidence?.value || additionalFields.confidence?.name || String(additionalFields.confidence)
        : String(additionalFields.confidence);
      detailsRows.push(createDetailRow('Confidence:', confidenceValue, rowIndex % 2 === 0));
      rowIndex++;
    }

    // Add Assignee if available
    if (additionalFields.assignee) {
      detailsRows.push(createDetailRow('Assignee:', additionalFields.assignee, rowIndex % 2 === 0));
      rowIndex++;
    }

    // Add Start Date if available
    if (additionalFields.startDate) {
      const startDateFormatted = new Date(additionalFields.startDate).toLocaleDateString();
      detailsRows.push(createDetailRow('Start Date:', startDateFormatted, rowIndex % 2 === 0));
      rowIndex++;
    }

    // Add End Date if available
    if (additionalFields.duedate) {
      const endDateFormatted = new Date(additionalFields.duedate).toLocaleDateString();
      detailsRows.push(createDetailRow('End Date:', endDateFormatted, rowIndex % 2 === 0));
      rowIndex++;
    }

    // Add Status
    detailsRows.push(createDetailRow('Status:', issueStatus, rowIndex % 2 === 0));
    rowIndex++;

    // Add Labels if available
    if (issueLabels.length > 0) {
      detailsRows.push(createDetailRow('Labels:', issueLabels.join(', '), rowIndex % 2 === 0));
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: PageOrientation.LANDSCAPE,
              },
            },
          },
          children: [
            // Title (blue like web page)
            new Paragraph({
              children: [
                new TextRun({
                  text: 'ABC Manager - Weekly Report',
                  bold: true,
                  color: "0052CC", // Blue like web page header
                  size: 32,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 400 },
            }),
            
            // Parent Issue Header (blue like web page)
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Parent Ticket Information',
                  bold: true,
                  color: "0052CC", // Blue like web page
                  size: 28,
                }),
              ],
              spacing: { before: 200, after: 200 },
            }),
            
            // Issue Key and Summary
            new Paragraph({
              children: [
                new TextRun({
                  text: `Ticket: `,
                  bold: true,
                  size: 28,
                  color: "172B4D", // Dark like web page
                }),
                new TextRun({
                  text: issueKey,
                  bold: true,
                  size: 28,
                  color: "0052CC", // Blue like web page
                }),
              ],
              spacing: { after: 100 },
            }),
            
            new Paragraph({
              children: [
                new TextRun({
                  text: `Summary: ${issueSummary}`,
                  size: 24,
                  color: "172B4D", // Dark like web page
                }),
              ],
              spacing: { after: 100 },
            }),
            
            // Issue Details Table
            new Table({
              rows: detailsRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" }, // Blue borders
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "0052CC" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "0052CC" },
              },
            }),
            
            new Paragraph({ text: '', spacing: { after: 400 } }),
            
            // Report Table Title (blue accent border like web page)
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Weekly Report',
                  bold: true,
                  color: "172B4D", // Dark like web page
                  size: 28,
                }),
              ],
              spacing: { before: 200, after: 200 },
              border: {
                bottom: {
                  color: "0052CC", // Blue border instead of grey
                  size: 4,
                  style: BorderStyle.SINGLE,
                },
              },
            }),
            
            // Report Table
            table,
            
            new Paragraph({ text: '', spacing: { after: 400 } }),
            
            // Timesheet Section (blue accent border like web page)
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Global Timesheet',
                  bold: true,
                  color: "172B4D", // Dark like web page
                  size: 28,
                }),
              ],
              spacing: { before: 200, after: 200 },
              border: {
                bottom: {
                  color: "0052CC", // Blue border like web page
                  size: 4,
                  style: BorderStyle.SINGLE,
                },
              },
            }),
            
            // Timesheet Summary Table - Parent Ticket
            new Table({
              rows: [
                new TableRow({
                  children: [
                    createHeaderCell('Parent Ticket', 40),
                    createHeaderCell('Time Spent', 20),
                    createHeaderCell('Estimate', 20),
                    createHeaderCell('Remaining Time', 20),
                  ],
                }),
                new TableRow({
                  children: [
                    createDataCell([
                      new Paragraph({
                        children: [
                          new TextRun({ text: issueKey, color: "0052CC", bold: true, font: "Courier New" }),
                          new TextRun({ text: `: ${issueSummary}`, color: "172B4D" }),
                        ],
                        spacing: { before: 200, after: 200 },
                      }),
                    ], false),
                    createDataCell(`${this.formatManDays(timesheet.parentTimeSpentManDays)}`, false),
                    createDataCell(`${this.formatManDays(timesheet.parentTimeEstimateManDays)}`, false),
                    createDataCell([
                      new Paragraph({
                        children: [
                          new TextRun({ 
                            text: this.formatManDays(timesheet.parentRemainingManDays ?? 0), 
                            color: (timesheet.parentRemainingManDays ?? 0) >= 0 ? "006644" : "FF991F",
                            bold: true,
                          }),
                        ],
                        spacing: { before: 200, after: 200 },
                      }),
                    ], false),
                  ],
                }),
              ],
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" }, // Blue borders
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "0052CC" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "0052CC" },
              },
            }),
            
            new Paragraph({ text: '', spacing: { after: 200 } }),

            // Detailed Timesheet Entries
            ...(timesheet.entries.length > 0 ? [
              new Paragraph({ text: '', spacing: { after: 200 } }),
              new Paragraph({
                children: [
                  new TextRun({ 
                    text: 'Detail by Ticket', 
                    bold: true, 
                    size: 22,
                    color: "172B4D", // Dark like web page
                  }),
                ],
                spacing: { after: 100 },
              }),
              new Table({
                rows: [
                  // Header
                  new TableRow({
                    children: [
                      createHeaderCell('Ticket', 12),
                      createHeaderCell('Summary', 32),
                      createHeaderCell('Time Spent', 12),
                      createHeaderCell('Estimate', 12),
                      createHeaderCell('Remaining Time', 12),
                      createHeaderCell('Status', 20),
                    ],
                  }),
                  // Data rows (blue ticket keys like web page)
                  ...timesheet.entries.map((entry, index) => 
                    new TableRow({
                      children: [
                        createDataCell(entry.issueKey, index % 2 === 0, true), // Blue ticket key
                        createDataCell(entry.summary, index % 2 === 0),
                        createDataCell(this.formatManDays(entry.timespentManDays), index % 2 === 0),
                        createDataCell(this.formatManDays(entry.timeestimateManDays), index % 2 === 0),
                        createDataCell([
                          new Paragraph({
                            children: [
                              new TextRun({ 
                                text: this.formatManDays(entry.remainingManDays ?? 0), 
                                color: (entry.remainingManDays ?? 0) >= 0 ? "006644" : "FF991F",
                                bold: true,
                              }),
                            ],
                            spacing: { before: 200, after: 200 },
                          }),
                        ], index % 2 === 0),
                        createDataCell(entry.status, index % 2 === 0),
                      ],
                    })
                  ),
                ],
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" }, // Blue borders
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "0052CC" },
                  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "0052CC" },
                  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "0052CC" },
                },
              }),
            ] : []),
          ],
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }
}

