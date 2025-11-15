import React, { useState } from 'react';
import { api } from '../services/api';
import './AuthModal.css';

interface AuthModalProps {
  onAuthenticated: (email: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated }) => {
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.authenticate(baseUrl, email, apiToken);
      if (response.success) {
        // Store credentials securely in sessionStorage (base64 encoded)
        const credentials = btoa(`${email}:${apiToken}`);
        sessionStorage.setItem('jira_credentials', credentials);
        sessionStorage.setItem('jira_email', email);
        sessionStorage.setItem('jira_base_url', baseUrl);
        onAuthenticated(response.user || email);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <h2 className="auth-modal-title">Jira Authentication</h2>
        <p className="auth-modal-description">
          Please enter your Jira credentials to access the ABC Manager report.
          Your credentials are stored securely in your browser session only.
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form-group">
            <label htmlFor="baseUrl" className="auth-label">
              Jira Base URL <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="url"
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="auth-input"
              placeholder="https://your-domain.atlassian.net"
              required
              disabled={loading}
            />
            <small className="auth-help-text">
              Your Jira instance URL (e.g., https://sunnybas.atlassian.net)
            </small>
          </div>
          <div className="auth-form-group">
            <label htmlFor="email" className="auth-label">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="your.email@example.com"
              required
              disabled={loading}
            />
          </div>
          <div className="auth-form-group">
            <label htmlFor="apiToken" className="auth-label">
              API Token
            </label>
            <input
              type="password"
              id="apiToken"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              className="auth-input"
              placeholder="Enter your Jira API token"
              required
              disabled={loading}
            />
            <small className="auth-help-text">
              Generate an API token from{' '}
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="auth-link"
              >
                Atlassian Account Settings
              </a>
            </small>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Authenticating...' : 'Authenticate'}
          </button>
        </form>
      </div>
    </div>
  );
};

