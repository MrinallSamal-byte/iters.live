const db = require('../database/db');
const cacheService = require('./cache.service');

/**
 * Advanced search service with global search capabilities
 */

class SearchService {
  /**
   * Global search across all resources
   */
  async globalSearch(query, options = {}) {
    const {
      userId,
      userRole,
      types = ['all'],
      page = 1,
      pageSize = 20,
      sortBy = 'relevance'
    } = options;

    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cached = cacheService.getApi(cacheKey);
    
    if (cached) {
      return cached;
    }

    const searchQuery = `%${query}%`;
    const results = {
      users: [],
      files: [],
      events: [],
      announcements: [],
      assignments: []
    };

    try {
      // Search users (if allowed)
      if (types.includes('all') || types.includes('users')) {
        const userResults = await db.query(
          `SELECT id, name, registration_number, email, department, role,
                  phone_number AS phone,
                  profile_picture AS profile_pic,
                  'user' as type
           FROM users
           WHERE (name LIKE ? OR registration_number LIKE ? OR email LIKE ?)
           AND is_active = TRUE
           LIMIT 10`,
          [searchQuery, searchQuery, searchQuery]
        );
        results.users = userResults || [];
      }

      // Search files
      if (types.includes('all') || types.includes('files')) {
        const fileResults = await db.query(
          `SELECT f.id, f.original_name as name, f.category, f.subject, 
                  f.created_at, u.name as uploaded_by_name, 'file' as type
           FROM files f
           LEFT JOIN users u ON f.uploaded_by = u.id
           WHERE (f.original_name LIKE ? OR f.description LIKE ? OR f.subject LIKE ?)
           AND f.approved = TRUE
           LIMIT 20`,
          [searchQuery, searchQuery, searchQuery]
        );
        results.files = fileResults || [];
      }

      // Search events
      if (types.includes('all') || types.includes('events')) {
        const eventResults = await db.query(
          `SELECT id, title as name, description, event_date, location, 
                  category, 'event' as type
           FROM events
           WHERE (title LIKE ? OR description LIKE ? OR location LIKE ?)
           AND is_active = TRUE
           AND event_date >= CURDATE()
           LIMIT 20`,
          [searchQuery, searchQuery, searchQuery]
        );
        results.events = eventResults || [];
      }

      // Search announcements
      if (types.includes('all') || types.includes('announcements')) {
        const announcementResults = await db.query(
          `SELECT id, title as name, content, category, created_at, 'announcement' as type
           FROM announcements
           WHERE (title LIKE ? OR content LIKE ?)
           AND (expires_at IS NULL OR expires_at > NOW())
           ORDER BY is_pinned DESC, created_at DESC
           LIMIT 20`,
          [searchQuery, searchQuery]
        );
        results.announcements = announcementResults || [];
      }

      // Search assignments (if student or teacher)
      if ((types.includes('all') || types.includes('assignments')) && 
          ['student', 'teacher'].includes(userRole)) {
        const assignmentResults = await db.query(
          `SELECT id, title as name, description, deadline, subject, 'assignment' as type
           FROM assignments
           WHERE (title LIKE ? OR description LIKE ? OR subject LIKE ?)
           AND deadline >= CURDATE()
           LIMIT 20`,
          [searchQuery, searchQuery, searchQuery]
        );
        results.assignments = assignmentResults || [];
      }

      // Combine and score results
      const allResults = [
        ...results.users,
        ...results.files,
        ...results.events,
        ...results.announcements,
        ...results.assignments
      ];

      // Calculate relevance score
      const scoredResults = allResults.map(item => {
        let score = 0;
        const lowerQuery = query.toLowerCase();
        const itemName = (item.name || '').toLowerCase();

        // Exact match gets highest score
        if (itemName === lowerQuery) score += 100;
        // Starts with query gets high score
        else if (itemName.startsWith(lowerQuery)) score += 50;
        // Contains query gets medium score
        else if (itemName.includes(lowerQuery)) score += 25;

        // Boost score based on type priority
        if (item.type === 'file') score += 10;
        if (item.type === 'event') score += 8;
        if (item.type === 'announcement') score += 5;

        return { ...item, score };
      });

      // Sort results
      let sortedResults = scoredResults;
      if (sortBy === 'relevance') {
        sortedResults = scoredResults.sort((a, b) => b.score - a.score);
      } else if (sortBy === 'date') {
        sortedResults = scoredResults.sort((a, b) => 
          new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
      }

      // Paginate
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = sortedResults.slice(startIndex, endIndex);

      const response = {
        success: true,
        query,
        results: paginatedResults,
        summary: {
          total: sortedResults.length,
          users: results.users.length,
          files: results.files.length,
          events: results.events.length,
          announcements: results.announcements.length,
          assignments: results.assignments.length
        },
        pagination: {
          page,
          pageSize,
          total: sortedResults.length,
          totalPages: Math.ceil(sortedResults.length / pageSize)
        }
      };

      // Cache for 2 minutes
      cacheService.setApi(cacheKey, response, 120);

      return response;
    } catch (error) {
      console.error('Global search error:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Search users with advanced filters
   */
  async searchUsers(query, filters = {}) {
    const {
      role,
      department,
      year,
      section,
      page = 1,
      pageSize = 20
    } = filters;

    let sql = `
      SELECT id, name, registration_number, email, phone_number, 
             department, year, section, role, profile_picture
      FROM users
      WHERE is_active = TRUE
    `;
    const params = [];

    if (query) {
      sql += ` AND (name LIKE ? OR registration_number LIKE ? OR email LIKE ?)`;
      const searchQuery = `%${query}%`;
      params.push(searchQuery, searchQuery, searchQuery);
    }

    if (role) {
      sql += ` AND role = ?`;
      params.push(role);
    }

    if (department) {
      sql += ` AND department = ?`;
      params.push(department);
    }

    if (year) {
      sql += ` AND year = ?`;
      params.push(year);
    }

    if (section) {
      sql += ` AND section = ?`;
      params.push(section);
    }

    // Get total count
    const countSql = sql.replace(
      'SELECT id, name, registration_number, email, phone_number, department, year, section, role, profile_picture',
      'SELECT COUNT(*) as total'
    );
  const countRows = await db.query(countSql, params);
  const total = countRows[0]?.total || 0;

    // Add pagination
    sql += ` ORDER BY name LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    try {
      const users = await db.query(sql, params);
      // Alias for client consumption
      const usersAliased = users.map(u => ({
        ...u,
        phone: u.phone_number !== undefined ? u.phone_number : u.phone,
        profile_pic: u.profile_picture !== undefined ? u.profile_picture : u.profile_pic
      }));

      return {
        success: true,
        users: usersAliased.map(({ phone_number, profile_picture, ...rest }) => rest),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Search users error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search files with advanced filters
   */
  async searchFiles(query, filters = {}) {
    const {
      category,
      subject,
      uploadedBy,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = filters;

    let sql = `
      SELECT f.*, u.name as uploaded_by_name
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.approved = TRUE
    `;
    const params = [];

    if (query) {
      sql += ` AND (f.original_name LIKE ? OR f.description LIKE ?)`;
      const searchQuery = `%${query}%`;
      params.push(searchQuery, searchQuery);
    }

    if (category) {
      sql += ` AND f.category = ?`;
      params.push(category);
    }

    if (subject) {
      sql += ` AND f.subject = ?`;
      params.push(subject);
    }

    if (uploadedBy) {
      sql += ` AND f.uploaded_by = ?`;
      params.push(uploadedBy);
    }

    if (startDate) {
      sql += ` AND f.created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND f.created_at <= ?`;
      params.push(endDate);
    }

    // Get total count
    const countSql = sql.replace(
      'SELECT f.*, u.name as uploaded_by_name',
      'SELECT COUNT(*) as total'
    );
  const countRows = await db.query(countSql, params);
  const total = countRows[0]?.total || 0;

    // Add sorting and pagination
    const allowedSortFields = ['created_at', 'file_size', 'download_count', 'original_name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY f.${sortField} ${order} LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    try {
      const files = await db.query(sql, params);

      return {
        success: true,
        files,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Search files error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSuggestions(query, type = 'all') {
    const cacheKey = `suggestions:${type}:${query}`;
    const cached = cacheService.getApi(cacheKey);
    
    if (cached) {
      return cached;
    }

    const searchQuery = `${query}%`;
    const suggestions = [];

    try {
      if (type === 'all' || type === 'users') {
        const [users] = await db.query(
          `SELECT name, 'user' as type FROM users 
           WHERE name LIKE ? AND is_active = TRUE
           LIMIT 5`,
          [searchQuery]
        );
        suggestions.push(...users);
      }

      if (type === 'all' || type === 'subjects') {
        const [subjects] = await db.query(
          `SELECT DISTINCT subject as name, 'subject' as type 
           FROM files 
           WHERE subject LIKE ? AND subject IS NOT NULL
           LIMIT 5`,
          [searchQuery]
        );
        suggestions.push(...subjects);
      }

      if (type === 'all' || type === 'files') {
        const [files] = await db.query(
          `SELECT original_name as name, 'file' as type 
           FROM files 
           WHERE original_name LIKE ? AND approved = TRUE
           LIMIT 5`,
          [searchQuery]
        );
        suggestions.push(...files);
      }

      const response = {
        success: true,
        suggestions: suggestions.slice(0, 10)
      };

      // Cache for 5 minutes
      cacheService.setApi(cacheKey, response, 300);

      return response;
    } catch (error) {
      console.error('Get suggestions error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get trending searches
   */
  async getTrendingSearches(limit = 10) {
    // This would require a search_history table
    // Placeholder implementation
    return {
      success: true,
      trending: [
        { query: 'Data Structures', count: 45 },
        { query: 'Python Notes', count: 38 },
        { query: 'Assignment 3', count: 32 }
      ]
    };
  }
}

module.exports = new SearchService();
