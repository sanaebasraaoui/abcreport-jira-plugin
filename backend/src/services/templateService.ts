/**
 * Template Service
 * 
 * Handles storage and retrieval of report templates.
 * Uses file-based storage (JSON files) for simplicity.
 * Can be easily migrated to database storage later.
 */

import fs from 'fs';
import path from 'path';
import { ReportTemplate, DEFAULT_TEMPLATE } from '../types/template';
import { randomUUID } from 'crypto';

/**
 * Template Storage Service
 * 
 * Manages report template persistence using file-based storage.
 * Templates are stored in a JSON file: `data/templates.json`
 */
export class TemplateService {
  private templatesFile: string;
  private templates: Map<string, ReportTemplate>;

  constructor(dataDir: string = path.join(__dirname, '../../data')) {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.templatesFile = path.join(dataDir, 'templates.json');
    this.templates = new Map();
    this.loadTemplates();
  }

  /**
   * Load templates from file
   */
  private loadTemplates(): void {
    try {
      if (fs.existsSync(this.templatesFile)) {
        const data = fs.readFileSync(this.templatesFile, 'utf-8');
        const templatesArray: ReportTemplate[] = JSON.parse(data);
        
        // Convert array to Map for faster lookup
        this.templates = new Map(
          templatesArray.map(template => [template.id, template])
        );
      } else {
        // Create empty templates file
        this.saveTemplates();
      }
    } catch (error: any) {
      console.error('Error loading templates:', error.message);
      this.templates = new Map();
    }
  }

  /**
   * Save templates to file
   */
  private saveTemplates(): void {
    try {
      const templatesArray = Array.from(this.templates.values());
      fs.writeFileSync(
        this.templatesFile,
        JSON.stringify(templatesArray, null, 2),
        'utf-8'
      );
    } catch (error: any) {
      console.error('Error saving templates:', error.message);
      throw new Error('Failed to save templates');
    }
  }

  /**
   * Get all templates for a user
   * 
   * @param userId - User identifier
   * @param includeShared - Whether to include shared templates
   * @returns Array of templates
   */
  getTemplatesForUser(userId: string, includeShared: boolean = true): ReportTemplate[] {
    const requestUserId = userId?.toLowerCase().trim();
    const userTemplates = Array.from(this.templates.values()).filter(
      template => {
        const templateUserId = template.userId?.toLowerCase().trim();
        return templateUserId === requestUserId || (includeShared && template.isShared);
      }
    );
    
    // Sort by updated date (newest first)
    return userTemplates.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Get a template by ID
   * 
   * @param templateId - Template ID
   * @param userId - User identifier (for authorization check)
   * @returns Template or null if not found or not accessible
   */
  getTemplate(templateId: string, userId: string): ReportTemplate | null {
    const template = this.templates.get(templateId);
    
    if (!template) {
      return null;
    }

    // Check if user has access (owner or shared)
    // Use case-insensitive comparison for email addresses
    const templateUserId = template.userId?.toLowerCase().trim();
    const requestUserId = userId?.toLowerCase().trim();
    
    if (templateUserId !== requestUserId && !template.isShared) {
      return null;
    }

    return template;
  }

  /**
   * Get default template for a user
   * Creates a default template if none exists
   * 
   * @param userId - User identifier
   * @returns Default template
   */
  getDefaultTemplate(userId: string): ReportTemplate {
    // Try to find user's default template
    const requestUserId = userId?.toLowerCase().trim();
    const userTemplates = this.getTemplatesForUser(userId, false);
    const defaultTemplate = userTemplates.find(t => {
      const templateUserId = t.userId?.toLowerCase().trim();
      return t.name === 'Default' && templateUserId === requestUserId;
    });
    
    if (defaultTemplate) {
      return defaultTemplate;
    }

    // Create default template
    const newTemplate: ReportTemplate = {
      id: randomUUID(),
      name: 'Default',
      description: DEFAULT_TEMPLATE.description,
      userId,
      isShared: false,
      fieldMapping: DEFAULT_TEMPLATE.fieldMapping,
      issueSelection: DEFAULT_TEMPLATE.issueSelection,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveTemplate(newTemplate);
    return newTemplate;
  }

  /**
   * Save a template
   * 
   * @param template - Template to save
   */
  saveTemplate(template: ReportTemplate): void {
    const now = new Date().toISOString();
    
    // Update timestamps
    if (!this.templates.has(template.id)) {
      // New template
      template.createdAt = now;
    }
    template.updatedAt = now;

    this.templates.set(template.id, template);
    this.saveTemplates();
  }

  /**
   * Create a new template
   * 
   * @param templateData - Template data (without id, timestamps)
   * @returns Created template
   */
  createTemplate(
    templateData: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): ReportTemplate {
    const template: ReportTemplate = {
      ...templateData,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveTemplate(template);
    return template;
  }

  /**
   * Update a template
   * 
   * @param templateId - Template ID
   * @param userId - User identifier (must be owner)
   * @param updates - Partial template data to update
   * @returns Updated template or null if not found/not authorized
   */
  updateTemplate(
    templateId: string,
    userId: string,
    updates: Partial<Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ): ReportTemplate | null {
    const template = this.templates.get(templateId);
    
    if (!template) {
      return null;
    }

    // Only owner can update - use case-insensitive comparison
    const templateUserId = template.userId?.toLowerCase().trim();
    const requestUserId = userId?.toLowerCase().trim();
    if (templateUserId !== requestUserId) {
      return null;
    }

    const updatedTemplate: ReportTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveTemplate(updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Delete a template
   * 
   * @param templateId - Template ID
   * @param userId - User identifier (must be owner)
   * @returns true if deleted, false if not found/not authorized
   */
  deleteTemplate(templateId: string, userId: string): boolean {
    const template = this.templates.get(templateId);
    
    if (!template) {
      return false;
    }

    // Only owner can delete - use case-insensitive comparison
    const templateUserId = template.userId?.toLowerCase().trim();
    const requestUserId = userId?.toLowerCase().trim();
    if (templateUserId !== requestUserId) {
      return false;
    }

    // Can't delete default template (can only update it)
    if (template.name === 'Default') {
      return false;
    }

    this.templates.delete(templateId);
    this.saveTemplates();
    return true;
  }

  /**
   * Clone a template
   * 
   * @param templateId - Template ID to clone
   * @param userId - User identifier
   * @param newName - Name for the cloned template
   * @returns Cloned template or null if not found/not accessible
   */
  cloneTemplate(templateId: string, userId: string, newName: string): ReportTemplate | null {
    const template = this.getTemplate(templateId, userId);
    
    if (!template) {
      return null;
    }

    const clonedTemplate: ReportTemplate = {
      ...template,
      id: randomUUID(),
      name: newName,
      userId, // Cloned template belongs to the user who cloned it
      isShared: false, // Cloned templates are not shared by default
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveTemplate(clonedTemplate);
    return clonedTemplate;
  }
}

