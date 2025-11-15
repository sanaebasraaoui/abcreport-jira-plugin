import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ReportData } from '../types';
import { IssueTable } from './IssueTable';
import { ExportButton } from './ExportButton';
import { ExportPptButton } from './ExportPptButton';
import { AutoCompleteInput } from './AutoCompleteInput';
import { TimesheetCard } from './TimesheetCard';
import { AuthModal } from './AuthModal';
import { TemplateSelector } from './TemplateSelector';
import { TemplateManager } from './TemplateManager';
import { normalizeStatusForClass, getStatusCategory } from '../utils/statusUtils';
import { isConnectApp } from '../utils/connectUtils';
import './WeeklyReport.css';

export const WeeklyReport: React.FC = () => {
  const [issueKey, setIssueKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  // Check if user is authenticated on mount
  useEffect(() => {
    // Always check session storage first (standalone mode credentials)
    const credentials = sessionStorage.getItem('jira_credentials');
    const email = sessionStorage.getItem('jira_email');
    const baseUrl = sessionStorage.getItem('jira_base_url');
    
    if (credentials && email && baseUrl) {
      // We have standalone credentials - use them
      setIsAuthenticated(true);
      setUserEmail(email);
      return;
    }
    
    // No standalone credentials - check if we're REALLY in Connect mode
    // (has JWT in URL, not just window.AP existing)
    const urlParams = new URLSearchParams(window.location.search);
    const hasJWT = urlParams.has('jwt');
    
    if (isConnectApp() && hasJWT) {
      // Really in Connect mode with JWT
      setIsAuthenticated(true);
      setUserEmail(null); // Connect handles user info
    } else {
      // Not authenticated - need to show modal
      setIsAuthenticated(false);
      setUserEmail(null);
    }
  }, []);

  const handleAuthenticated = (email: string) => {
    setIsAuthenticated(true);
    setUserEmail(email);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('jira_credentials');
    sessionStorage.removeItem('jira_email');
    sessionStorage.removeItem('jira_base_url');
    setIsAuthenticated(false);
    setUserEmail(null);
    setReportData(null);
    setIssueKey('');
  };

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

  const handleFetch = async (keyToFetch?: string) => {
    // Use provided key or fall back to issueKey state
    const keyToUse = keyToFetch || issueKey;
    const trimmedKey = keyToUse.trim().toUpperCase();
    
    if (!trimmedKey) {
      setError('Please enter a ticket key');
      return;
    }

    // Validate format
    if (!/^[A-Z]+-\d+$/.test(trimmedKey)) {
      setError(`Invalid format: "${trimmedKey}". Expected format: PROJ-123`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use selected template ID if available
      const data = await api.getReport(trimmedKey, selectedTemplateId || undefined);
      setReportData(data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load report';
      console.error('Failed to fetch report:', errorMessage, err);
      setError(errorMessage);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (selectedKey: string) => {
    const trimmedKey = selectedKey.trim().toUpperCase();
    setIssueKey(trimmedKey);
    // Auto-fetch when a suggestion is selected (only if it's a valid format)
    if (trimmedKey && /^[A-Z]+-\d+$/.test(trimmedKey)) {
      // Pass the selected key directly to handleFetch to avoid state update timing issues
      setTimeout(() => {
        handleFetch(trimmedKey);
      }, 100);
    }
  };

  // Show authentication modal if not authenticated
  // Show modal if no credentials in sessionStorage, regardless of Connect mode detection
  if (!isAuthenticated) {
    return <AuthModal onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="weekly-report">
      <div className="auth-header">
        <span className="auth-user-info">
          {userEmail ? `Logged in as: ${userEmail}` : 'Connected to Jira'}
        </span>
        {userEmail && (
          <button onClick={handleLogout} className="auth-logout-button">
            Logout
          </button>
        )}
      </div>
      <header className="report-header">
        <h1>ABC Manager - Weekly</h1>
      </header>

      <div className="report-container">
        <div className="input-section">
          <div className="input-group">
            <label htmlFor="issueKey">Jira Ticket Key:</label>
            <AutoCompleteInput
              value={issueKey}
              onChange={setIssueKey}
              onSelect={handleSelect}
              placeholder="Enter a ticket key (e.g., KAN-4) or search..."
              disabled={loading}
            />
            <button 
              onClick={() => handleFetch()} 
              disabled={loading || !issueKey.trim()}
              className="fetch-button"
            >
              {loading ? 'Loading...' : 'Load Report'}
            </button>
          </div>
          
          {/* Template Selector */}
          <div className="template-section">
            <TemplateSelector
              selectedTemplateId={selectedTemplateId}
              onTemplateChange={(templateId) => {
                setSelectedTemplateId(templateId);
                // Reload report with new template if report is already loaded
                if (reportData && issueKey.trim()) {
                  handleFetch();
                }
              }}
            />
            <button
              className="manage-templates-button"
              onClick={() => setShowTemplateManager(true)}
              type="button"
            >
              Manage Templates
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {reportData && (
          <div className="report-section">
            {/* Parent Issue Info Card */}
            <div className="parent-issue-card">
              <div className="parent-issue-header">
                <h2>{reportData.parentIssue.key}</h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <ExportButton issueKey={reportData.parentIssue.key} templateId={selectedTemplateId} />
                  <ExportPptButton issueKey={reportData.parentIssue.key} templateId={selectedTemplateId} />
                </div>
              </div>
              <div className="parent-issue-content">
                <div className="parent-issue-main">
                  <h3>{reportData.parentIssue.summary}</h3>
                </div>
                <div className="parent-issue-meta">
                  <div className="meta-item">
                    <span className="meta-label">Type:</span>
                    <span className="meta-value">{reportData.parentIssue.issuetype}</span>
                  </div>
                  {reportData.parentIssue.confidence !== undefined && reportData.parentIssue.confidence !== null && (
                    <div className="meta-item">
                      <span className="meta-label">Confidence:</span>
                      <span className="meta-value">
                        {typeof reportData.parentIssue.confidence === 'object' 
                          ? reportData.parentIssue.confidence?.value || reportData.parentIssue.confidence?.name || String(reportData.parentIssue.confidence)
                          : String(reportData.parentIssue.confidence)}
                      </span>
                    </div>
                  )}
                  {reportData.parentIssue.assignee && (
                    <div className="meta-item">
                      <span className="meta-label">Assignee:</span>
                      <span className="meta-value">{reportData.parentIssue.assignee}</span>
                    </div>
                  )}
                  {reportData.parentIssue.startDate && (
                    <div className="meta-item">
                      <span className="meta-label">Start Date:</span>
                      <span className="meta-value">
                        {new Date(reportData.parentIssue.startDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {reportData.parentIssue.endDate && (
                    <div className="meta-item">
                      <span className="meta-label">End Date:</span>
                      <span className="meta-value">
                        {new Date(reportData.parentIssue.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="meta-item">
                    <span className="meta-label">Status:</span>
                    <span className={`meta-value status status-${normalizeStatusForClass(reportData.parentIssue.status)} status-${getStatusCategory(reportData.parentIssue.status)}`}>
                      {reportData.parentIssue.status}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Children:</span>
                    <span className="meta-value">{reportData.childrenCount}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Time Spent Global:</span>
                    <span className="meta-value primary">{formatManDays(reportData.timesheet?.totalTimeSpentManDays ?? reportData.timesheet?.totalTimeSpentHours ? (reportData.timesheet.totalTimeSpentHours / 8) : 0)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Remaining Time:</span>
                    <span className={`meta-value ${((reportData.timesheet?.parentRemainingManDays ?? reportData.timesheet?.parentRemainingHours ? (reportData.timesheet.parentRemainingHours / 8) : 0) >= 0) ? 'success' : 'warning'}`}>
                      {formatManDays(reportData.timesheet?.parentRemainingManDays ?? reportData.timesheet?.parentRemainingHours ? (reportData.timesheet.parentRemainingHours / 8) : 0)}
                    </span>
                  </div>
                  {reportData.parentIssue.labels.length > 0 && (
                    <div className="meta-item meta-labels">
                      <span className="meta-label">Labels:</span>
                      <div className="labels-container">
                        {reportData.parentIssue.labels.map((label, idx) => (
                          <span key={idx} className="label-badge">{label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Report Table */}
            <div className="report-table-section">
              <h3 className="section-title">Weekly Report</h3>
              <IssueTable rows={reportData.report} weekNumbers={reportData.weekNumbers} />
            </div>

            {/* Timesheet Card */}
            <TimesheetCard timesheet={reportData.timesheet} />
          </div>
        )}
      </div>

      {/* Template Manager Modal */}
      <TemplateManager
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        onTemplateSelect={(templateId) => {
          setSelectedTemplateId(templateId);
          // Reload report with new template if report is already loaded
          if (reportData && issueKey.trim()) {
            handleFetch();
          }
        }}
      />
    </div>
  );
};

