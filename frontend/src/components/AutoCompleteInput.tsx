import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { IssueSuggestion } from '../types';
import './AutoCompleteInput.css';

interface AutoCompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const AutoCompleteInput: React.FC<AutoCompleteInputProps> = ({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
}) => {
  const [suggestions, setSuggestions] = useState<IssueSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const query = value.trim();
    
    // Don't search if query is too short or looks like a complete key (e.g., "KAN-123")
    if (query.length < 2 || /^[A-Z]+-\d+$/.test(query.toUpperCase())) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce search
    debounceTimerRef.current = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          const results = await api.searchIssues(query);
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
          setSelectedIndex(-1);
        } catch (error) {
          console.error('Search error:', error);
          setSuggestions([]);
          setShowSuggestions(false);
        } finally {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    onChange(newValue);
  };

  const handleSelect = (suggestion: IssueSuggestion) => {
    const selectedKey = suggestion.key.toUpperCase().trim();
    onChange(selectedKey);
    onSelect(selectedKey);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        // Only select suggestion if one is highlighted and it's a valid key format
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          const suggestion = suggestions[selectedIndex];
          // Validate that the suggestion has a complete key format
          if (suggestion.key && /^[A-Z]+-\d+$/i.test(suggestion.key.trim())) {
            handleSelect(suggestion);
          }
        } else {
          // If no suggestion selected but user pressed Enter, try to use current input value
          // This allows typing "KAN-4" and pressing Enter without selecting from dropdown
          const trimmedValue = value.trim().toUpperCase();
          if (trimmedValue && /^[A-Z]+-\d+$/.test(trimmedValue)) {
            onChange(trimmedValue);
            onSelect(trimmedValue);
          }
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <div className="autocomplete-input-container">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="autocomplete-input"
        />
        {loading && (
          <div className="autocomplete-spinner">
            <div className="spinner"></div>
          </div>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="autocomplete-suggestions">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.key}
              className={`autocomplete-suggestion ${
                index === selectedIndex ? 'selected' : ''
              }`}
              onClick={() => handleSelect(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="suggestion-content">
                <span className="suggestion-key">{suggestion.key}</span>
                <span className="suggestion-separator">:</span>
                <span className="suggestion-summary">{suggestion.summary}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

