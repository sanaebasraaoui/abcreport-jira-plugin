/**
 * Template Editor Component
 * 
 * Modal/form component for creating and editing report templates.
 * Allows users to configure field mappings for Category, Initiative, and Issue Items.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ReportTemplate, FieldMappingConfig, IssueSelectionConfig, COMMON_FIELD_PATHS } from '../types/template';
import './TemplateEditor.css';

interface TemplateEditorProps {
  template: ReportTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<FieldMappingConfig>({
    categoryField: 'fields.parent.fields.summary',
    initiativeField: 'fields.labels',
    issueItemField: 'fields.summary',
    multiValueHandling: 'join',
    multiValueSeparator: ', ',
  });
  const [issueSelection, setIssueSelection] = useState<IssueSelectionConfig>({
    maxDepth: 1,
    includeNestedChildren: false,
    parentGroupingField: 'fields.parent.key',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setIsShared(template.isShared);
      setFieldMapping(template.fieldMapping);
      setIssueSelection(template.issueSelection);
    } else {
      // Reset to defaults for new template
      setName('');
      setDescription('');
      setIsShared(false);
      setFieldMapping({
        categoryField: 'fields.parent.fields.summary',
        initiativeField: 'fields.labels',
        issueItemField: 'fields.summary',
        multiValueHandling: 'join',
        multiValueSeparator: ', ',
      });
      setIssueSelection({
        maxDepth: 1,
        includeNestedChildren: false,
        parentGroupingField: 'fields.parent.key',
      });
    }
    setError(null);
  }, [template, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Get userId from sessionStorage (standalone mode) or from default template (Connect mode)
      let userId: string | undefined;
      
      // Try to get email from sessionStorage first (standalone mode)
      const email = sessionStorage.getItem('jira_email');
      if (email) {
        userId = email;
      } else {
        // No email in sessionStorage - we're in Connect mode
        // The backend will extract userId from JWT/Connect context
        // We don't need to pass userId explicitly - backend handles it
        userId = undefined;
      }

      if (template) {
        // Update existing template
        await api.updateTemplate(template.id, {
          name,
          description,
          isShared,
          fieldMapping,
          issueSelection,
        });
      } else {
        // Create new template
        // If userId is available from sessionStorage, pass it
        // Otherwise, let the backend extract it from JWT/Connect context
        const templateData: any = {
          name,
          description,
          isShared,
          fieldMapping,
          issueSelection,
        };
        
        // Only include userId if we have it from sessionStorage
        // In Connect mode, the backend will extract it from the request
        if (userId) {
          templateData.userId = userId;
        }
        
        await api.createTemplate(templateData);
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('Failed to save template:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="template-editor-overlay" onClick={onClose}>
      <div className="template-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="template-editor-header">
          <h2>{template ? 'Edit Template' : 'Create New Template'}</h2>
          <button className="close-button" onClick={onClose} type="button">×</button>
        </div>

        <form onSubmit={handleSubmit} className="template-editor-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="template-name">
              Template Name <span className="required">*</span>
            </label>
            <input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={template?.name === 'Default'}
              placeholder="e.g., My Custom Template"
            />
            {template?.name === 'Default' && (
              <small className="helper-text">Default template name cannot be changed</small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="template-description">Description</label>
            <textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description of this template"
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
              />
              Share this template with other users
            </label>
          </div>

          <div className="section-divider">
            <h3>Field Mappings</h3>
            <p className="section-description">
              Configure which fields from Jira issues are used for each column in the report.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="category-field">
              Category Field <span className="required">*</span>
            </label>
            <input
              id="category-field"
              type="text"
              value={fieldMapping.categoryField}
              onChange={(e) => setFieldMapping({ ...fieldMapping, categoryField: e.target.value })}
              required
              placeholder="e.g., fields.parent.fields.summary"
            />
            <small className="helper-text">
              Field path from parent issue used for the Category column
            </small>
            <div className="common-fields">
              <strong>Common fields:</strong>
              {COMMON_FIELD_PATHS.map(field => (
                <button
                  key={field.value}
                  type="button"
                  className="field-button"
                  onClick={() => setFieldMapping({ ...fieldMapping, categoryField: field.value })}
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="initiative-field">
              Initiative Field <span className="required">*</span>
            </label>
            <input
              id="initiative-field"
              type="text"
              value={fieldMapping.initiativeField}
              onChange={(e) => setFieldMapping({ ...fieldMapping, initiativeField: e.target.value })}
              required
              placeholder="e.g., fields.labels"
            />
            <small className="helper-text">
              Field path from child issues used for grouping rows (Initiative column)
            </small>
            <div className="common-fields">
              <strong>Common fields:</strong>
              {COMMON_FIELD_PATHS.map(field => (
                <button
                  key={field.value}
                  type="button"
                  className="field-button"
                  onClick={() => setFieldMapping({ ...fieldMapping, initiativeField: field.value })}
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="issue-item-field">
              Issue Item Field <span className="required">*</span>
            </label>
            <input
              id="issue-item-field"
              type="text"
              value={fieldMapping.issueItemField}
              onChange={(e) => setFieldMapping({ ...fieldMapping, issueItemField: e.target.value })}
              required
              placeholder="e.g., fields.summary"
            />
            <small className="helper-text">
              Field path from child issues displayed in Last Week, Current Week, Next Week, Later columns
            </small>
            <div className="common-fields">
              <strong>Common fields:</strong>
              {COMMON_FIELD_PATHS.map(field => (
                <button
                  key={field.value}
                  type="button"
                  className="field-button"
                  onClick={() => setFieldMapping({ ...fieldMapping, issueItemField: field.value })}
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="multi-value-handling">Multi-Value Field Handling</label>
            <select
              id="multi-value-handling"
              value={fieldMapping.multiValueHandling}
              onChange={(e) => setFieldMapping({
                ...fieldMapping,
                multiValueHandling: e.target.value as 'join' | 'first' | 'all'
              })}
            >
              <option value="join">Join values with separator</option>
              <option value="first">Use first value only</option>
              <option value="all">Create separate rows for each value</option>
            </select>
            <small className="helper-text">
              How to handle fields with multiple values (like labels)
            </small>
          </div>

          {fieldMapping.multiValueHandling === 'join' && (
            <div className="form-group">
              <label htmlFor="separator">Separator</label>
              <input
                id="separator"
                type="text"
                value={fieldMapping.multiValueSeparator}
                onChange={(e) => setFieldMapping({ ...fieldMapping, multiValueSeparator: e.target.value })}
                placeholder=", "
              />
              <small className="helper-text">
                Separator for joining multiple values (e.g., ", " or " | ")
              </small>
            </div>
          )}

          <div className="section-divider">
            <h3>Issue Selection</h3>
            <p className="section-description">
              Configure which child issues are included in the report.
            </p>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={issueSelection.includeNestedChildren}
                onChange={(e) => setIssueSelection({
                  ...issueSelection,
                  includeNestedChildren: e.target.checked
                })}
              />
              Include nested children (children of children)
            </label>
            <small className="helper-text">
              When enabled, the report will include child issues at multiple levels
            </small>
          </div>

          {issueSelection.includeNestedChildren && (
            <div className="form-group">
              <label htmlFor="max-depth">Maximum Depth</label>
              <input
                id="max-depth"
                type="number"
                min="1"
                max="10"
                value={issueSelection.maxDepth}
                onChange={(e) => setIssueSelection({
                  ...issueSelection,
                  maxDepth: parseInt(e.target.value, 10) || 1
                })}
              />
              <small className="helper-text">
                Maximum depth for nested children (1 = only direct children, 2 = children and grandchildren, etc.)
              </small>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="parent-grouping-field">Parent Grouping Field</label>
            <input
              id="parent-grouping-field"
              type="text"
              value={issueSelection.parentGroupingField}
              onChange={(e) => setIssueSelection({
                ...issueSelection,
                parentGroupingField: e.target.value
              })}
              placeholder="e.g., fields.parent.key"
            />
            <small className="helper-text">
              Field path used to group issues by parent (usually fields.parent.key)
            </small>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

