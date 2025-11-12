/**
 * Resume Builder Component
 * Professional resume templates with PDF export
 */

class ResumeBuilder {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container ${containerId} not found`);
    }

    this.options = {
      template: 'modern', // modern, classic, creative, ats
      ...options
    };

    this.state = {
      personalInfo: {
        fullName: '',
        email: '',
        phone: '',
        location: '',
        linkedin: '',
        github: '',
        website: '',
        summary: ''
      },
      education: [],
      experience: [],
      projects: [],
      skills: [],
      certifications: [],
      languages: []
    };

    this.init();
  }

  /**
   * Initialize resume builder
   */
  init() {
    this.loadResume();
    this.render();
    this.startAutoSave();
  }

  /**
   * Render builder
   */
  render() {
    this.container.innerHTML = `
      <div class="resume-builder">
        <div class="builder-sidebar">
          <div class="sidebar-header">
            <h2><i class="fas fa-file-alt"></i> Resume Builder</h2>
          </div>

          <div class="template-selector">
            <h3>Choose Template</h3>
            <div class="template-grid">
              ${this.renderTemplateOptions()}
            </div>
          </div>

          <div class="builder-actions">
            <button class="btn btn-primary btn-block" id="preview-btn">
              <i class="fas fa-eye"></i> Preview
            </button>
            <button class="btn btn-secondary btn-block" id="export-pdf-btn">
              <i class="fas fa-download"></i> Export PDF
            </button>
            <button class="btn btn-secondary btn-block" id="clear-btn">
              <i class="fas fa-trash"></i> Clear All
            </button>
          </div>

          <div class="saved-status">
            <i class="fas fa-check-circle"></i>
            <span id="save-status">Auto-saved</span>
          </div>
        </div>

        <div class="builder-editor">
          <div class="editor-sections">
            <!-- Personal Information -->
            <div class="editor-section">
              <div class="section-header">
                <h3><i class="fas fa-user"></i> Personal Information</h3>
              </div>
              <div class="section-content">
                <div class="form-row">
                  <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" id="fullName" value="${this.state.personalInfo.fullName}" placeholder="John Doe" required>
                  </div>
                  <div class="form-group">
                    <label>Email *</label>
                    <input type="email" id="email" value="${this.state.personalInfo.email}" placeholder="john@example.com" required>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="phone" value="${this.state.personalInfo.phone}" placeholder="+1 234 567 8900">
                  </div>
                  <div class="form-group">
                    <label>Location</label>
                    <input type="text" id="location" value="${this.state.personalInfo.location}" placeholder="New York, NY">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>LinkedIn</label>
                    <input type="text" id="linkedin" value="${this.state.personalInfo.linkedin}" placeholder="linkedin.com/in/johndoe">
                  </div>
                  <div class="form-group">
                    <label>GitHub</label>
                    <input type="text" id="github" value="${this.state.personalInfo.github}" placeholder="github.com/johndoe">
                  </div>
                </div>
                <div class="form-group">
                  <label>Professional Summary</label>
                  <textarea id="summary" rows="4" placeholder="Brief overview of your experience and skills...">${this.state.personalInfo.summary}</textarea>
                </div>
              </div>
            </div>

            <!-- Education -->
            <div class="editor-section">
              <div class="section-header">
                <h3><i class="fas fa-graduation-cap"></i> Education</h3>
                <button class="btn-icon" onclick="window.resumeBuilder.addEducation()">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              <div class="section-content" id="education-list">
                ${this.renderEducationList()}
              </div>
            </div>

            <!-- Experience -->
            <div class="editor-section">
              <div class="section-header">
                <h3><i class="fas fa-briefcase"></i> Work Experience</h3>
                <button class="btn-icon" onclick="window.resumeBuilder.addExperience()">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              <div class="section-content" id="experience-list">
                ${this.renderExperienceList()}
              </div>
            </div>

            <!-- Projects -->
            <div class="editor-section">
              <div class="section-header">
                <h3><i class="fas fa-code"></i> Projects</h3>
                <button class="btn-icon" onclick="window.resumeBuilder.addProject()">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              <div class="section-content" id="projects-list">
                ${this.renderProjectsList()}
              </div>
            </div>

            <!-- Skills -->
            <div class="editor-section">
              <div class="section-header">
                <h3><i class="fas fa-tools"></i> Skills</h3>
                <button class="btn-icon" onclick="window.resumeBuilder.addSkill()">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              <div class="section-content">
                <div class="skills-input">
                  <input type="text" id="skill-input" placeholder="Add a skill (e.g., JavaScript, React)">
                  <button class="btn-add" onclick="window.resumeBuilder.addSkill()">Add</button>
                </div>
                <div class="skills-list" id="skills-list">
                  ${this.renderSkillsList()}
                </div>
              </div>
            </div>

            <!-- Certifications -->
            <div class="editor-section">
              <div class="section-header">
                <h3><i class="fas fa-certificate"></i> Certifications</h3>
                <button class="btn-icon" onclick="window.resumeBuilder.addCertification()">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              <div class="section-content" id="certifications-list">
                ${this.renderCertificationsList()}
              </div>
            </div>
          </div>
        </div>

        <div class="builder-preview" id="builder-preview" style="display: none;">
          <div class="preview-header">
            <h3>Preview</h3>
            <button class="btn-icon" id="close-preview-btn">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="preview-content" id="preview-content">
            ${this.renderPreview()}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
    window.resumeBuilder = this;
  }

  /**
   * Render template options
   */
  renderTemplateOptions() {
    const templates = [
      { id: 'modern', name: 'Modern', icon: 'fa-star' },
      { id: 'classic', name: 'Classic', icon: 'fa-file-alt' },
      { id: 'creative', name: 'Creative', icon: 'fa-palette' },
      { id: 'ats', name: 'ATS-Friendly', icon: 'fa-robot' }
    ];

    return templates.map(t => `
      <div class="template-option ${this.options.template === t.id ? 'active' : ''}" 
           onclick="window.resumeBuilder.changeTemplate('${t.id}')">
        <i class="fas ${t.icon}"></i>
        <span>${t.name}</span>
      </div>
    `).join('');
  }

  /**
   * Render education list
   */
  renderEducationList() {
    if (this.state.education.length === 0) {
      return '<p class="empty-message">No education added yet</p>';
    }

    return this.state.education.map((edu, index) => `
      <div class="list-item">
        <div class="item-content">
          <strong>${edu.degree} in ${edu.field}</strong>
          <p>${edu.school} | ${edu.location}</p>
          <p>${edu.startDate} - ${edu.endDate} ${edu.gpa ? `| GPA: ${edu.gpa}` : ''}</p>
        </div>
        <div class="item-actions">
          <button class="btn-icon-sm" onclick="window.resumeBuilder.editEducation(${index})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon-sm" onclick="window.resumeBuilder.removeEducation(${index})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render experience list
   */
  renderExperienceList() {
    if (this.state.experience.length === 0) {
      return '<p class="empty-message">No experience added yet</p>';
    }

    return this.state.experience.map((exp, index) => `
      <div class="list-item">
        <div class="item-content">
          <strong>${exp.title}</strong>
          <p>${exp.company} | ${exp.location}</p>
          <p>${exp.startDate} - ${exp.endDate || 'Present'}</p>
          <ul>
            ${exp.description.split('\n').map(line => line.trim() ? `<li>${line}</li>` : '').join('')}
          </ul>
        </div>
        <div class="item-actions">
          <button class="btn-icon-sm" onclick="window.resumeBuilder.editExperience(${index})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon-sm" onclick="window.resumeBuilder.removeExperience(${index})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render projects list
   */
  renderProjectsList() {
    if (this.state.projects.length === 0) {
      return '<p class="empty-message">No projects added yet</p>';
    }

    return this.state.projects.map((proj, index) => `
      <div class="list-item">
        <div class="item-content">
          <strong>${proj.name}</strong>
          ${proj.link ? `<a href="${proj.link}" target="_blank"><i class="fas fa-external-link-alt"></i></a>` : ''}
          <p>${proj.technologies}</p>
          <p>${proj.description}</p>
        </div>
        <div class="item-actions">
          <button class="btn-icon-sm" onclick="window.resumeBuilder.editProject(${index})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon-sm" onclick="window.resumeBuilder.removeProject(${index})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render skills list
   */
  renderSkillsList() {
    if (this.state.skills.length === 0) {
      return '<p class="empty-message">No skills added yet</p>';
    }

    return this.state.skills.map((skill, index) => `
      <div class="skill-tag">
        ${skill}
        <button class="btn-remove" onclick="window.resumeBuilder.removeSkill(${index})">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');
  }

  /**
   * Render certifications list
   */
  renderCertificationsList() {
    if (this.state.certifications.length === 0) {
      return '<p class="empty-message">No certifications added yet</p>';
    }

    return this.state.certifications.map((cert, index) => `
      <div class="list-item">
        <div class="item-content">
          <strong>${cert.name}</strong>
          <p>${cert.issuer} | ${cert.date}</p>
          ${cert.credentialId ? `<p>Credential ID: ${cert.credentialId}</p>` : ''}
        </div>
        <div class="item-actions">
          <button class="btn-icon-sm" onclick="window.resumeBuilder.removeCertification(${index})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Personal info inputs
    ['fullName', 'email', 'phone', 'location', 'linkedin', 'github', 'summary'].forEach(field => {
      const input = document.getElementById(field);
      if (input) {
        input.addEventListener('input', (e) => {
          this.state.personalInfo[field] = e.target.value;
          this.saveResume();
        });
      }
    });

    // Preview and export
    document.getElementById('preview-btn')?.addEventListener('click', () => this.showPreview());
    document.getElementById('close-preview-btn')?.addEventListener('click', () => this.hidePreview());
    document.getElementById('export-pdf-btn')?.addEventListener('click', () => this.exportPDF());
    document.getElementById('clear-btn')?.addEventListener('click', () => this.clearAll());
  }

  /**
   * Add education
   */
  addEducation() {
    const degree = prompt('Degree (e.g., Bachelor of Science):');
    if (!degree) return;

    const field = prompt('Field of Study:');
    const school = prompt('School Name:');
    const location = prompt('Location:');
    const startDate = prompt('Start Date (e.g., Aug 2018):');
    const endDate = prompt('End Date (e.g., May 2022):');
    const gpa = prompt('GPA (optional):');

    this.state.education.push({
      degree,
      field,
      school,
      location,
      startDate,
      endDate,
      gpa
    });

    this.saveResume();
    this.refreshSection('education-list', this.renderEducationList());
  }

  /**
   * Remove education
   */
  removeEducation(index) {
    if (confirm('Remove this education entry?')) {
      this.state.education.splice(index, 1);
      this.saveResume();
      this.refreshSection('education-list', this.renderEducationList());
    }
  }

  /**
   * Add experience
   */
  addExperience() {
    const title = prompt('Job Title:');
    if (!title) return;

    const company = prompt('Company Name:');
    const location = prompt('Location:');
    const startDate = prompt('Start Date (e.g., Jan 2021):');
    const endDate = prompt('End Date (or leave blank for current):');
    const description = prompt('Description (use line breaks for bullet points):');

    this.state.experience.push({
      title,
      company,
      location,
      startDate,
      endDate,
      description: description || ''
    });

    this.saveResume();
    this.refreshSection('experience-list', this.renderExperienceList());
  }

  /**
   * Remove experience
   */
  removeExperience(index) {
    if (confirm('Remove this experience entry?')) {
      this.state.experience.splice(index, 1);
      this.saveResume();
      this.refreshSection('experience-list', this.renderExperienceList());
    }
  }

  /**
   * Add project
   */
  addProject() {
    const name = prompt('Project Name:');
    if (!name) return;

    const technologies = prompt('Technologies Used:');
    const description = prompt('Project Description:');
    const link = prompt('Project Link (optional):');

    this.state.projects.push({
      name,
      technologies,
      description,
      link
    });

    this.saveResume();
    this.refreshSection('projects-list', this.renderProjectsList());
  }

  /**
   * Remove project
   */
  removeProject(index) {
    if (confirm('Remove this project?')) {
      this.state.projects.splice(index, 1);
      this.saveResume();
      this.refreshSection('projects-list', this.renderProjectsList());
    }
  }

  /**
   * Add skill
   */
  addSkill() {
    const input = document.getElementById('skill-input');
    const skill = input?.value.trim();
    
    if (skill && !this.state.skills.includes(skill)) {
      this.state.skills.push(skill);
      this.saveResume();
      this.refreshSection('skills-list', this.renderSkillsList());
      if (input) input.value = '';
    }
  }

  /**
   * Remove skill
   */
  removeSkill(index) {
    this.state.skills.splice(index, 1);
    this.saveResume();
    this.refreshSection('skills-list', this.renderSkillsList());
  }

  /**
   * Add certification
   */
  addCertification() {
    const name = prompt('Certification Name:');
    if (!name) return;

    const issuer = prompt('Issuing Organization:');
    const date = prompt('Date Issued (e.g., Jan 2023):');
    const credentialId = prompt('Credential ID (optional):');

    this.state.certifications.push({
      name,
      issuer,
      date,
      credentialId
    });

    this.saveResume();
    this.refreshSection('certifications-list', this.renderCertificationsList());
  }

  /**
   * Remove certification
   */
  removeCertification(index) {
    if (confirm('Remove this certification?')) {
      this.state.certifications.splice(index, 1);
      this.saveResume();
      this.refreshSection('certifications-list', this.renderCertificationsList());
    }
  }

  /**
   * Change template
   */
  changeTemplate(templateId) {
    this.options.template = templateId;
    this.render();
  }

  /**
   * Show preview
   */
  showPreview() {
    const preview = document.getElementById('builder-preview');
    const content = document.getElementById('preview-content');
    content.innerHTML = this.renderPreview();
    preview.style.display = 'block';
  }

  /**
   * Hide preview
   */
  hidePreview() {
    document.getElementById('builder-preview').style.display = 'none';
  }

  /**
   * Render preview based on template
   */
  renderPreview() {
    const { personalInfo, education, experience, projects, skills, certifications } = this.state;

    return `
      <div class="resume-preview ${this.options.template}">
        <div class="resume-header">
          <h1>${personalInfo.fullName || 'Your Name'}</h1>
          <div class="resume-contact">
            ${personalInfo.email ? `<span><i class="fas fa-envelope"></i> ${personalInfo.email}</span>` : ''}
            ${personalInfo.phone ? `<span><i class="fas fa-phone"></i> ${personalInfo.phone}</span>` : ''}
            ${personalInfo.location ? `<span><i class="fas fa-map-marker-alt"></i> ${personalInfo.location}</span>` : ''}
            ${personalInfo.linkedin ? `<span><i class="fab fa-linkedin"></i> ${personalInfo.linkedin}</span>` : ''}
            ${personalInfo.github ? `<span><i class="fab fa-github"></i> ${personalInfo.github}</span>` : ''}
          </div>
        </div>

        ${personalInfo.summary ? `
          <div class="resume-section">
            <h2>Professional Summary</h2>
            <p>${personalInfo.summary}</p>
          </div>
        ` : ''}

        ${education.length > 0 ? `
          <div class="resume-section">
            <h2>Education</h2>
            ${education.map(edu => `
              <div class="resume-item">
                <div class="item-header">
                  <strong>${edu.degree} in ${edu.field}</strong>
                  <span>${edu.startDate} - ${edu.endDate}</span>
                </div>
                <div class="item-subtitle">
                  ${edu.school}, ${edu.location}
                  ${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${experience.length > 0 ? `
          <div class="resume-section">
            <h2>Work Experience</h2>
            ${experience.map(exp => `
              <div class="resume-item">
                <div class="item-header">
                  <strong>${exp.title}</strong>
                  <span>${exp.startDate} - ${exp.endDate || 'Present'}</span>
                </div>
                <div class="item-subtitle">${exp.company}, ${exp.location}</div>
                <ul>
                  ${exp.description.split('\n').map(line => line.trim() ? `<li>${line}</li>` : '').join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${projects.length > 0 ? `
          <div class="resume-section">
            <h2>Projects</h2>
            ${projects.map(proj => `
              <div class="resume-item">
                <strong>${proj.name}</strong>
                ${proj.link ? ` | <a href="${proj.link}" target="_blank">${proj.link}</a>` : ''}
                <p><em>${proj.technologies}</em></p>
                <p>${proj.description}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${skills.length > 0 ? `
          <div class="resume-section">
            <h2>Skills</h2>
            <div class="resume-skills">
              ${skills.join(' • ')}
            </div>
          </div>
        ` : ''}

        ${certifications.length > 0 ? `
          <div class="resume-section">
            <h2>Certifications</h2>
            ${certifications.map(cert => `
              <div class="resume-item">
                <strong>${cert.name}</strong> - ${cert.issuer} (${cert.date})
                ${cert.credentialId ? `<br>Credential ID: ${cert.credentialId}` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Export to PDF
   */
  exportPDF() {
    this.showPreview();
    setTimeout(() => {
      window.print();
    }, 500);
  }

  /**
   * Clear all data
   */
  clearAll() {
    if (confirm('Are you sure you want to clear all resume data?')) {
      this.state = {
        personalInfo: { fullName: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '', summary: '' },
        education: [],
        experience: [],
        projects: [],
        skills: [],
        certifications: [],
        languages: []
      };
      this.saveResume();
      this.render();
      if (window.showToast) {
        window.showToast('Resume cleared', 'success');
      }
    }
  }

  /**
   * Refresh section
   */
  refreshSection(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = html;
    }
  }

  /**
   * Start auto-save
   */
  startAutoSave() {
    setInterval(() => {
      this.saveResume();
      const status = document.getElementById('save-status');
      if (status) {
        status.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
      }
    }, 30000); // Auto-save every 30 seconds
  }

  /**
   * Save resume
   */
  saveResume() {
    localStorage.setItem('resume-data', JSON.stringify(this.state));
  }

  /**
   * Load resume
   */
  loadResume() {
    try {
      const saved = localStorage.getItem('resume-data');
      if (saved) {
        this.state = { ...this.state, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Load resume error:', error);
    }
  }
}

// Export
window.ResumeBuilder = ResumeBuilder;
export default ResumeBuilder;
