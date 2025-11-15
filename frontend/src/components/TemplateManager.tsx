/**
 * Template Manager Component
 * 
 * Component for managing templates (list, edit, delete, clone).
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ReportTemplate } from '../types/template';
import { TemplateEditor } from './TemplateEditor';
import './TemplateManager.css';

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateSelect?: (templateId: string) => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  isOpen,
  onClose,
  onTemplateSelect,
}) => {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedTemplates = await api.getTemplates(true);
      setTemplates(fetchedTemplates);
    } catch (err: any) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleEdit = (template: ReportTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleClone = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const newName = prompt(`Enter a name for the cloned template:`, `${template.name} (Copy)`);
    if (!newName || !newName.trim()) return;

    try {
      setCloningTemplateId(templateId);
      await api.cloneTemplate(templateId, newName.trim());
      await loadTemplates();
      // Notify TemplateSelector to refresh
      window.dispatchEvent(new Event('templates-refresh'));
    } catch (err: any) {
      alert(`Failed to clone template: ${err.response?.data?.error || err.message}`);
    } finally {
      setCloningTemplateId(null);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await api.deleteTemplate(templateId);
      await loadTemplates();
      setDeleteConfirmId(null);
      // Notify TemplateSelector to refresh
      window.dispatchEvent(new Event('templates-refresh'));
    } catch (err: any) {
      alert(`Failed to delete template: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleSave = async () => {
    await loadTemplates();
    setShowEditor(false);
    setEditingTemplate(null);
    // Notify TemplateSelector to refresh
    window.dispatchEvent(new Event('templates-refresh'));
  };

  const handleSelect = (templateId: string) => {
    if (onTemplateSelect) {
      onTemplateSelect(templateId);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="template-manager-overlay" onClick={onClose}>
        <div className="template-manager-modal" onClick={(e) => e.stopPropagation()}>
          <div className="template-manager-header">
            <h2>Manage Templates</h2>
            <button className="close-button" onClick={onClose} type="button">×</button>
          </div>

          <div className="template-manager-content">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="template-manager-actions">
              <button className="create-button" onClick={handleCreate}>
                + Create New Template
              </button>
            </div>

            {loading && templates.length === 0 ? (
              <div className="loading-message">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="empty-message">
                No templates found. Create your first template to customize field mappings.
              </div>
            ) : (
              <div className="templates-list">
                {templates.map(template => (
                  <div key={template.id} className="template-item">
                    <div className="template-item-header">
                      <div className="template-item-title">
                        <h3>{template.name}</h3>
                        {template.isShared && (
                          <span className="shared-badge">Shared</span>
                        )}
                        {template.name === 'Default' && (
                          <span className="default-badge">Default</span>
                        )}
                      </div>
                      <div className="template-item-actions">
                        {onTemplateSelect && (
                          <button
                            className="select-button"
                            onClick={() => handleSelect(template.id)}
                          >
                            Select
                          </button>
                        )}
                        <button
                          className="edit-button"
                          onClick={() => handleEdit(template)}
                        >
                          Edit
                        </button>
                        {template.name !== 'Default' && (
                          <>
                            <button
                              className="clone-button"
                              onClick={() => handleClone(template.id)}
                              disabled={cloningTemplateId === template.id}
                            >
                              {cloningTemplateId === template.id ? 'Cloning...' : 'Clone'}
                            </button>
                            <button
                              className="delete-button"
                              onClick={() => handleDelete(template.id)}
                              disabled={deleteConfirmId === template.id}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {template.description && (
                      <p className="template-description">{template.description}</p>
                    )}
                    <div className="template-details">
                      <div className="detail-item">
                        <strong>Category:</strong> {template.fieldMapping.categoryField}
                      </div>
                      <div className="detail-item">
                        <strong>Initiative:</strong> {template.fieldMapping.initiativeField}
                      </div>
                      <div className="detail-item">
                        <strong>Issue Item:</strong> {template.fieldMapping.issueItemField}
                      </div>
                    </div>
                    <div className="template-meta">
                      Updated: {new Date(template.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditor && (
        <TemplateEditor
          template={editingTemplate}
          isOpen={showEditor}
          onClose={() => {
            setShowEditor(false);
            setEditingTemplate(null);
          }}
          onSave={handleSave}
        />
      )}
    </>
  );
};

