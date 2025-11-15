import React, { useState } from 'react';
import { api } from '../services/api';
import './ExportButton.css';

interface ExportButtonProps {
  issueKey: string;
  templateId?: string | null;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ issueKey, templateId }) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const blob = await api.exportWord(issueKey, templateId || undefined);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ABC-Manager-Weekly-${issueKey}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Failed to export: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      className="export-button" 
      onClick={handleExport}
      disabled={loading}
    >
      {loading ? 'Exporting...' : 'Download Word Document'}
    </button>
  );
};

