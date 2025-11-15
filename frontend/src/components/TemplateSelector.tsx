/**
 * Template Selector Component
 * 
 * Dropdown component for selecting a template to use for report generation.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ReportTemplate } from '../types/template';
import './TemplateSelector.css';

interface TemplateSelectorProps {
  selectedTemplateId: string | null;
  onTemplateChange: (templateId: string | null) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplateId,
  onTemplateChange,
}) => {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadTemplates();
  }, [refreshKey]);

  // Listen for custom event to refresh templates
  useEffect(() => {
    const handleRefresh = () => {
      setRefreshKey(prev => prev + 1);
    };
    
    window.addEventListener('templates-refresh', handleRefresh);
    return () => {
      window.removeEventListener('templates-refresh', handleRefresh);
    };
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedTemplates = await api.getTemplates(true);
      setTemplates(fetchedTemplates);
      
      // If no template is selected, select the default one
      if (!selectedTemplateId && fetchedTemplates.length > 0) {
        const defaultTemplate = fetchedTemplates.find(t => t.name === 'Default') || fetchedTemplates[0];
        onTemplateChange(defaultTemplate.id);
      } else if (selectedTemplateId) {
        // Verify the selected template still exists
        const templateExists = fetchedTemplates.some(t => t.id === selectedTemplateId);
        if (!templateExists && fetchedTemplates.length > 0) {
          // Selected template was deleted, select default
          const defaultTemplate = fetchedTemplates.find(t => t.name === 'Default') || fetchedTemplates[0];
          onTemplateChange(defaultTemplate.id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onTemplateChange(value === '' ? null : value);
  };

  if (loading && templates.length === 0) {
    return (
      <div className="template-selector loading">
        <span>Loading templates...</span>
      </div>
    );
  }

  return (
    <div className="template-selector">
      <label htmlFor="template-select">Report Template:</label>
      <select
        id="template-select"
        value={selectedTemplateId || ''}
        onChange={handleChange}
        disabled={loading}
      >
        {loading && templates.length === 0 ? (
          <option value="">Loading...</option>
        ) : templates.length === 0 ? (
          <option value="">No templates available</option>
        ) : (
          templates.map(template => (
            <option key={template.id} value={template.id}>
              {template.name} {template.isShared ? '(Shared)' : ''} {template.name === 'Default' ? '(Default)' : ''}
            </option>
          ))
        )}
      </select>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
};

