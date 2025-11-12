/**
 * Flashcard Creator & Study Tool
 * Create, manage, and study with digital flashcards
 */

class FlashcardSystem {
  constructor() {
    this.flashcards = [];
    this.currentDeck = null;
    this.studyMode = false;
    this.currentIndex = 0;
    this.score = { correct: 0, incorrect: 0 };
  }

  /**
   * Initialize the flashcard system
   */
  async init() {
    await this.loadDecks();
    this.setupEventListeners();
    this.renderDeckList();
  }

  /**
   * Load flashcard decks from API/localStorage
   */
  async loadDecks() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/flashcards/my-decks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.decks = data.success ? data.data : [];
      } else {
        // Fallback to localStorage
        this.decks = JSON.parse(localStorage.getItem('flashcardDecks') || '[]');
      }
    } catch (error) {
      console.error('Error loading flashcard decks:', error);
      this.decks = JSON.parse(localStorage.getItem('flashcardDecks') || '[]');
    }
  }

  /**
   * Render deck list
   */
  renderDeckList() {
    const container = document.getElementById('flashcard-container');
    if (!container) return;

    let html = `
      <div class="flashcard-system">
        <div class="flashcard-header">
          <h3>🎴 Flashcard Study System</h3>
          <button class="btn btn-primary" onclick="flashcardSystem.createNewDeck()">
            <i class="fas fa-plus"></i> Create New Deck
          </button>
        </div>

        <div class="deck-stats">
          <div class="stat-card">
            <span class="stat-label">Total Decks</span>
            <span class="stat-value">${this.decks.length}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Cards</span>
            <span class="stat-value">${this.getTotalCards()}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Study Time Today</span>
            <span class="stat-value">${this.getStudyTimeToday()}min</span>
          </div>
        </div>

        <div class="deck-grid">
    `;

    if (this.decks.length === 0) {
      html += `
        <div class="empty-state">
          <i class="fas fa-layer-group fa-3x"></i>
          <p>No flashcard decks yet</p>
          <button class="btn btn-primary" onclick="flashcardSystem.createNewDeck()">
            Create Your First Deck
          </button>
        </div>
      `;
    } else {
      this.decks.forEach(deck => {
        const progress = deck.cards ? this.calculateProgress(deck) : 0;
        html += `
          <div class="deck-card">
            <div class="deck-header">
              <h4>${deck.name}</h4>
              <div class="deck-actions">
                <button class="btn-icon" onclick="flashcardSystem.editDeck('${deck.id}')" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="flashcardSystem.deleteDeck('${deck.id}')" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="deck-meta">
              <span><i class="fas fa-layer-group"></i> ${deck.cards ? deck.cards.length : 0} cards</span>
              <span><i class="fas fa-book"></i> ${deck.subject || 'General'}</span>
            </div>
            <div class="deck-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
              </div>
              <span class="progress-text">${progress}% mastered</span>
            </div>
            <div class="deck-buttons">
              <button class="btn btn-primary" onclick="flashcardSystem.studyDeck('${deck.id}')">
                <i class="fas fa-graduation-cap"></i> Study
              </button>
              <button class="btn btn-secondary" onclick="flashcardSystem.addCards('${deck.id}')">
                <i class="fas fa-plus"></i> Add Cards
              </button>
            </div>
            ${deck.lastStudied ? `
              <div class="deck-footer">
                Last studied: ${new Date(deck.lastStudied).toLocaleDateString()}
              </div>
            ` : ''}
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Create new deck
   */
  createNewDeck() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Create New Flashcard Deck</h3>
          <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Deck Name *</label>
            <input type="text" id="deck-name" placeholder="e.g., Data Structures - Trees" required>
          </div>
          <div class="form-group">
            <label>Subject</label>
            <input type="text" id="deck-subject" placeholder="e.g., Computer Science">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="deck-description" placeholder="Optional description..." rows="3"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="flashcardSystem.saveDeck()">Create & Add Cards</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('deck-name').focus();
  }

  /**
   * Save new deck
   */
  saveDeck() {
    const name = document.getElementById('deck-name').value.trim();
    const subject = document.getElementById('deck-subject').value.trim();
    const description = document.getElementById('deck-description').value.trim();

    if (!name) {
      showToast('Please enter a deck name', 'error');
      return;
    }

    const newDeck = {
      id: Date.now().toString(),
      name,
      subject,
      description,
      cards: [],
      created: new Date().toISOString(),
      lastStudied: null
    };

    this.decks.push(newDeck);
    this.saveToStorage();
    
    document.querySelector('.modal-overlay').remove();
    showToast('Deck created successfully!', 'success');
    
    // Open card editor
    this.addCards(newDeck.id);
    this.renderDeckList();
  }

  /**
   * Add cards to deck
   */
  addCards(deckId) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3>Add Cards to "${deck.name}"</h3>
          <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="card-editor">
            <div class="editor-tabs">
              <button class="tab-btn active" onclick="flashcardSystem.switchEditorTab('manual')">
                Manual Entry
              </button>
              <button class="tab-btn" onclick="flashcardSystem.switchEditorTab('bulk')">
                Bulk Import
              </button>
            </div>

            <div id="manual-editor" class="editor-content">
              <div class="form-group">
                <label>Question/Front</label>
                <textarea id="card-question" placeholder="What is the time complexity of binary search?" rows="3"></textarea>
              </div>
              <div class="form-group">
                <label>Answer/Back</label>
                <textarea id="card-answer" placeholder="O(log n)" rows="3"></textarea>
              </div>
              <div class="form-group">
                <label>Hint (Optional)</label>
                <input type="text" id="card-hint" placeholder="Think about how many elements are eliminated each step">
              </div>
              <button class="btn btn-primary" onclick="flashcardSystem.addSingleCard('${deckId}')">
                <i class="fas fa-plus"></i> Add Card
              </button>
            </div>

            <div id="bulk-editor" class="editor-content" style="display: none;">
              <div class="form-group">
                <label>Bulk Import (Format: Question | Answer)</label>
                <textarea id="bulk-cards" placeholder="What is HTML? | HyperText Markup Language
What is CSS? | Cascading Style Sheets
What is JavaScript? | Programming language for web" rows="10"></textarea>
              </div>
              <button class="btn btn-primary" onclick="flashcardSystem.importBulkCards('${deckId}')">
                <i class="fas fa-upload"></i> Import All Cards
              </button>
            </div>
          </div>

          <div class="added-cards">
            <h4>Cards in this deck (${deck.cards.length})</h4>
            <div id="card-list-${deckId}">
              ${this.renderCardList(deck.cards)}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove(); flashcardSystem.renderDeckList();">
            Done
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Switch editor tab
   */
  switchEditorTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('manual-editor').style.display = tab === 'manual' ? 'block' : 'none';
    document.getElementById('bulk-editor').style.display = tab === 'bulk' ? 'block' : 'none';
  }

  /**
   * Add single card
   */
  addSingleCard(deckId) {
    const question = document.getElementById('card-question').value.trim();
    const answer = document.getElementById('card-answer').value.trim();
    const hint = document.getElementById('card-hint').value.trim();

    if (!question || !answer) {
      showToast('Please fill in both question and answer', 'error');
      return;
    }

    const deck = this.decks.find(d => d.id === deckId);
    if (!deck) return;

    const card = {
      id: Date.now().toString(),
      question,
      answer,
      hint,
      created: new Date().toISOString(),
      mastery: 0, // 0-100 based on correct answers
      lastReviewed: null,
      reviewCount: 0
    };

    deck.cards.push(card);
    this.saveToStorage();

    // Clear form
    document.getElementById('card-question').value = '';
    document.getElementById('card-answer').value = '';
    document.getElementById('card-hint').value = '';

    // Update card list
    document.getElementById(`card-list-${deckId}`).innerHTML = this.renderCardList(deck.cards);
    
    showToast('Card added!', 'success');
  }

  /**
   * Import bulk cards
   */
  importBulkCards(deckId) {
    const bulkText = document.getElementById('bulk-cards').value.trim();
    if (!bulkText) {
      showToast('Please enter cards to import', 'error');
      return;
    }

    const deck = this.decks.find(d => d.id === deckId);
    if (!deck) return;

    const lines = bulkText.split('\n').filter(line => line.trim());
    let imported = 0;

    lines.forEach(line => {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        const card = {
          id: Date.now().toString() + Math.random(),
          question: parts[0],
          answer: parts[1],
          hint: parts[2] || '',
          created: new Date().toISOString(),
          mastery: 0,
          lastReviewed: null,
          reviewCount: 0
        };
        deck.cards.push(card);
        imported++;
      }
    });

    this.saveToStorage();
    document.getElementById('bulk-cards').value = '';
    document.getElementById(`card-list-${deckId}`).innerHTML = this.renderCardList(deck.cards);
    
    showToast(`${imported} cards imported successfully!`, 'success');
  }

  /**
   * Render card list
   */
  renderCardList(cards) {
    if (cards.length === 0) {
      return '<p class="empty-message">No cards yet. Add your first card above.</p>';
    }

    let html = '<div class="card-list-grid">';
    cards.forEach((card, index) => {
      html += `
        <div class="mini-card">
          <div class="mini-card-header">
            <span>#${index + 1}</span>
            <button class="btn-icon btn-sm" onclick="flashcardSystem.deleteCard('${card.id}')">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="mini-card-question">${this.truncateText(card.question, 50)}</div>
          <div class="mini-card-mastery">
            <div class="mastery-bar" style="width: ${card.mastery}%"></div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  /**
   * Study deck
   */
  studyDeck(deckId) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck || !deck.cards || deck.cards.length === 0) {
      showToast('This deck has no cards to study', 'error');
      return;
    }

    this.currentDeck = deck;
    this.currentIndex = 0;
    this.score = { correct: 0, incorrect: 0 };
    this.studyMode = true;
    
    // Shuffle cards for better learning
    this.currentDeck.cards = this.shuffleArray([...deck.cards]);

    this.renderStudyMode();
  }

  /**
   * Render study mode
   */
  renderStudyMode() {
    const container = document.getElementById('flashcard-container');
    const card = this.currentDeck.cards[this.currentIndex];
    const progress = ((this.currentIndex + 1) / this.currentDeck.cards.length) * 100;

    container.innerHTML = `
      <div class="study-mode">
        <div class="study-header">
          <button class="btn btn-secondary" onclick="flashcardSystem.exitStudyMode()">
            <i class="fas fa-arrow-left"></i> Exit
          </button>
          <h3>${this.currentDeck.name}</h3>
          <div class="study-score">
            <span class="correct">✓ ${this.score.correct}</span>
            <span class="incorrect">✗ ${this.score.incorrect}</span>
          </div>
        </div>

        <div class="study-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <span class="progress-text">Card ${this.currentIndex + 1} of ${this.currentDeck.cards.length}</span>
        </div>

        <div class="flashcard-viewer">
          <div class="flashcard" id="study-card" onclick="flashcardSystem.flipCard()">
            <div class="card-face card-front">
              <div class="card-label">Question</div>
              <div class="card-content">${card.question}</div>
              ${card.hint ? `<div class="card-hint">💡 ${card.hint}</div>` : ''}
              <div class="flip-instruction">Click to flip</div>
            </div>
            <div class="card-face card-back" style="display: none;">
              <div class="card-label">Answer</div>
              <div class="card-content">${card.answer}</div>
              <div class="flip-instruction">Click to flip back</div>
            </div>
          </div>
        </div>

        <div class="study-actions">
          <p>How well did you know this?</p>
          <div class="action-buttons">
            <button class="btn btn-danger" onclick="flashcardSystem.markCard('incorrect')">
              <i class="fas fa-times"></i> Didn't Know
            </button>
            <button class="btn btn-warning" onclick="flashcardSystem.markCard('partial')">
              <i class="fas fa-minus"></i> Partially
            </button>
            <button class="btn btn-success" onclick="flashcardSystem.markCard('correct')">
              <i class="fas fa-check"></i> Knew It!
            </button>
          </div>
        </div>

        <div class="study-keyboard-hint">
          Keyboard shortcuts: ← Previous | Space Flip | → Next
        </div>
      </div>
    `;

    this.setupStudyKeyboardShortcuts();
  }

  /**
   * Flip card
   */
  flipCard() {
    const front = document.querySelector('.card-front');
    const back = document.querySelector('.card-back');
    
    if (front.style.display !== 'none') {
      front.style.display = 'none';
      back.style.display = 'flex';
    } else {
      front.style.display = 'flex';
      back.style.display = 'none';
    }
  }

  /**
   * Mark card
   */
  markCard(result) {
    const card = this.currentDeck.cards[this.currentIndex];
    
    // Update card mastery
    if (result === 'correct') {
      this.score.correct++;
      card.mastery = Math.min(100, card.mastery + 20);
    } else if (result === 'partial') {
      card.mastery = Math.min(100, card.mastery + 5);
    } else {
      this.score.incorrect++;
      card.mastery = Math.max(0, card.mastery - 10);
    }

    card.lastReviewed = new Date().toISOString();
    card.reviewCount++;

    // Move to next card
    if (this.currentIndex < this.currentDeck.cards.length - 1) {
      this.currentIndex++;
      this.renderStudyMode();
    } else {
      this.finishStudySession();
    }

    this.saveToStorage();
  }

  /**
   * Finish study session
   */
  finishStudySession() {
    const accuracy = ((this.score.correct / (this.score.correct + this.score.incorrect)) * 100).toFixed(1);
    this.currentDeck.lastStudied = new Date().toISOString();
    this.saveToStorage();

    const container = document.getElementById('flashcard-container');
    container.innerHTML = `
      <div class="study-complete">
        <div class="complete-icon">
          <i class="fas fa-trophy fa-5x"></i>
        </div>
        <h2>Study Session Complete! 🎉</h2>
        <div class="complete-stats">
          <div class="stat-card">
            <span class="stat-label">Cards Studied</span>
            <span class="stat-value">${this.currentDeck.cards.length}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Correct</span>
            <span class="stat-value correct">${this.score.correct}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Incorrect</span>
            <span class="stat-value incorrect">${this.score.incorrect}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Accuracy</span>
            <span class="stat-value">${accuracy}%</span>
          </div>
        </div>
        <div class="complete-actions">
          <button class="btn btn-primary" onclick="flashcardSystem.studyDeck('${this.currentDeck.id}')">
            <i class="fas fa-redo"></i> Study Again
          </button>
          <button class="btn btn-secondary" onclick="flashcardSystem.exitStudyMode()">
            <i class="fas fa-home"></i> Back to Decks
          </button>
        </div>
      </div>
    `;

    // Track study time
    this.updateStudyTime(this.currentDeck.cards.length * 0.5); // Estimate 30 seconds per card
  }

  /**
   * Exit study mode
   */
  exitStudyMode() {
    this.studyMode = false;
    this.currentDeck = null;
    this.currentIndex = 0;
    this.renderDeckList();
  }

  /**
   * Setup keyboard shortcuts for study mode
   */
  setupStudyKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!this.studyMode) return;

      switch(e.key) {
        case ' ':
          e.preventDefault();
          this.flipCard();
          break;
        case 'ArrowLeft':
          if (this.currentIndex > 0) {
            this.currentIndex--;
            this.renderStudyMode();
          }
          break;
        case 'ArrowRight':
          this.markCard('correct');
          break;
      }
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Auto-save on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveToStorage();
      }
    });
  }

  /**
   * Delete card
   */
  deleteCard(cardId) {
    this.decks.forEach(deck => {
      deck.cards = deck.cards.filter(card => card.id !== cardId);
    });
    this.saveToStorage();
  }

  /**
   * Delete deck
   */
  deleteDeck(deckId) {
    if (!confirm('Are you sure you want to delete this deck?')) return;
    
    this.decks = this.decks.filter(d => d.id !== deckId);
    this.saveToStorage();
    this.renderDeckList();
    showToast('Deck deleted', 'success');
  }

  /**
   * Save to localStorage and API
   */
  saveToStorage() {
    localStorage.setItem('flashcardDecks', JSON.stringify(this.decks));
    
    // TODO: Save to API
    // fetch('/api/flashcards/save', { ... });
  }

  /**
   * Calculate deck progress
   */
  calculateProgress(deck) {
    if (!deck.cards || deck.cards.length === 0) return 0;
    const avgMastery = deck.cards.reduce((sum, card) => sum + card.mastery, 0) / deck.cards.length;
    return Math.round(avgMastery);
  }

  /**
   * Get total cards across all decks
   */
  getTotalCards() {
    return this.decks.reduce((sum, deck) => sum + (deck.cards ? deck.cards.length : 0), 0);
  }

  /**
   * Get study time today
   */
  getStudyTimeToday() {
    const studyLog = JSON.parse(localStorage.getItem('studyTimeLog') || '{}');
    const today = new Date().toDateString();
    return studyLog[today] || 0;
  }

  /**
   * Update study time
   */
  updateStudyTime(minutes) {
    const studyLog = JSON.parse(localStorage.getItem('studyTimeLog') || '{}');
    const today = new Date().toDateString();
    studyLog[today] = (studyLog[today] || 0) + minutes;
    localStorage.setItem('studyTimeLog', JSON.stringify(studyLog));
  }

  // Utility functions
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}

// Initialize
const flashcardSystem = new FlashcardSystem();

// Auto-initialize if container exists
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('flashcard-container')) {
      flashcardSystem.init();
    }
  });
} else {
  if (document.getElementById('flashcard-container')) {
    flashcardSystem.init();
  }
}
