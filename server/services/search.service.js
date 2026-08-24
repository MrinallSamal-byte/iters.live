const cacheService = require('./cache.service');
const { listRecords } = require('./firebase-data.service');

class SearchService {
  async globalSearch(query, options = {}) {
    const {
      userRole,
      types = ['all'],
      page = 1,
      pageSize = 20,
      sortBy = 'relevance'
    } = options;

    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cached = await cacheService.getApi(cacheKey);
    if (cached) return cached;

    const q = String(query || '').toLowerCase();
    const results = {
      users: [],
      files: [],
      events: [],
      announcements: [],
      assignments: [],
      notes: [],
      clubs: []
    };

    try {
      const [users, files, events, assignments, announcements, notes, clubs] = await Promise.all([
        listRecords('users'),
        listRecords('files'),
        listRecords('events'),
        listRecords('assignments'),
        listRecords('announcements'),
        listRecords('notes'),
        listRecords('clubs')
      ]);

      if (types.includes('all') || types.includes('users')) {
        // ponytail: PII gate keyed on caller role -> field-level ACL if more roles need partial access
        const canViewContactInfo = ['teacher', 'admin'].includes(userRole);
        results.users = users
          .filter((user) => user.is_active !== false)
          .filter((user) =>
            String(user.name || '').toLowerCase().includes(q)
            || String(user.registration_number || '').toLowerCase().includes(q)
            || String(user.email || '').toLowerCase().includes(q)
          )
          .slice(0, 10)
          .map((user) => ({
            id: user.id,
            name: user.name,
            registration_number: user.registration_number,
            email: canViewContactInfo ? user.email : null,
            department: user.department,
            role: user.role,
            phone: canViewContactInfo ? (user.phone_number || null) : null,
            profile_pic: canViewContactInfo ? (user.profile_picture || null) : null,
            type: 'user'
          }));
      }

      if (types.includes('all') || types.includes('files')) {
        results.files = files
          .filter((file) => file.approved === true)
          .filter((file) =>
            String(file.original_name || '').toLowerCase().includes(q)
            || String(file.description || '').toLowerCase().includes(q)
            || String(file.subject || '').toLowerCase().includes(q)
          )
          .slice(0, 20)
          .map((file) => ({
            id: file.id,
            name: file.original_name,
            category: file.category,
            subject: file.subject,
            created_at: file.created_at,
            uploaded_by_name: file.uploaded_by_name || null,
            type: 'file'
          }));
      }

      if (types.includes('all') || types.includes('events')) {
        results.events = events
          .filter((event) => event.is_active !== false)
          .filter((event) =>
            String(event.title || '').toLowerCase().includes(q)
            || String(event.description || '').toLowerCase().includes(q)
            || String(event.location || '').toLowerCase().includes(q)
          )
          .slice(0, 20)
          .map((event) => ({
            id: event.id,
            name: event.title,
            description: event.description,
            event_date: event.event_date,
            location: event.location,
            category: event.category,
            type: 'event'
          }));
      }

      if ((types.includes('all') || types.includes('assignments')) && ['student', 'teacher', 'admin'].includes(userRole)) {
        results.assignments = assignments
          .filter((assignment) =>
            String(assignment.title || '').toLowerCase().includes(q)
            || String(assignment.description || '').toLowerCase().includes(q)
            || String(assignment.subject || '').toLowerCase().includes(q)
          )
          .slice(0, 20)
          .map((assignment) => ({
            id: assignment.id,
            name: assignment.title,
            description: assignment.description,
            deadline: assignment.deadline,
            subject: assignment.subject,
            type: 'assignment'
          }));
      }

      if (types.includes('all') || types.includes('announcements')) {
        results.announcements = announcements
          .filter((announcement) => announcement.is_active !== false && announcement.status !== 'archived')
          .filter((announcement) =>
            String(announcement.title || '').toLowerCase().includes(q)
            || String(announcement.content || '').toLowerCase().includes(q)
          )
          .slice(0, 20)
          .map((announcement) => ({
            id: announcement.id,
            name: announcement.title,
            description: announcement.content,
            priority: announcement.priority,
            created_at: announcement.created_at,
            type: 'announcement'
          }));
      }

      if (types.includes('all') || types.includes('notes')) {
        results.notes = notes
          .filter((note) => note.status !== 'rejected')
          .filter((note) =>
            String(note.title || '').toLowerCase().includes(q)
            || String(note.description || '').toLowerCase().includes(q)
            || String(note.subject || '').toLowerCase().includes(q)
            || String(note.tags || '').toLowerCase().includes(q)
          )
          .slice(0, 20)
          .map((note) => ({
            id: note.id,
            name: note.title,
            description: note.description,
            subject: note.subject,
            created_at: note.created_at,
            uploaded_by_name: note.uploaded_by_name || null,
            type: 'note'
          }));
      }

      if (types.includes('all') || types.includes('clubs')) {
        results.clubs = clubs
          .filter((club) => club.is_active !== false)
          .filter((club) =>
            String(club.name || '').toLowerCase().includes(q)
            || String(club.description || '').toLowerCase().includes(q)
          )
          .slice(0, 20)
          .map((club) => ({
            id: club.id,
            name: club.name,
            description: club.description,
            category: club.category,
            created_at: club.created_at,
            type: 'club'
          }));
      }

      const allResults = [
        ...results.users,
        ...results.files,
        ...results.events,
        ...results.announcements,
        ...results.assignments,
        ...results.notes,
        ...results.clubs
      ];

      const scoredResults = allResults.map((item) => {
        const itemName = String(item.name || '').toLowerCase();
        let score = 0;
        if (itemName === q) score += 100;
        else if (itemName.startsWith(q)) score += 50;
        else if (itemName.includes(q)) score += 25;
        if (item.type === 'file') score += 10;
        if (item.type === 'event') score += 8;
        if (item.type === 'announcement') score += 5;
        if (item.type === 'note') score += 6;
        if (item.type === 'club') score += 4;
        return { ...item, score };
      });

      let sortedResults = scoredResults;
      if (sortBy === 'relevance') {
        sortedResults = [...scoredResults].sort((a, b) => b.score - a.score);
      } else if (sortBy === 'date') {
        sortedResults = [...scoredResults].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }

      const startIndex = (page - 1) * pageSize;
      const response = {
        success: true,
        query,
        results: sortedResults.slice(startIndex, startIndex + pageSize),
        summary: {
          total: sortedResults.length,
          users: results.users.length,
          files: results.files.length,
          events: results.events.length,
          announcements: results.announcements.length,
          assignments: results.assignments.length,
          notes: results.notes.length,
          clubs: results.clubs.length
        },
        pagination: {
          page,
          pageSize,
          total: sortedResults.length,
          totalPages: Math.ceil(sortedResults.length / pageSize)
        }
      };

      cacheService.setApi(cacheKey, response, 120);
      return response;
    } catch (error) {
      console.error('Global search error:', error);
      return { success: false, error: error.message, results: [] };
    }
  }

  async searchUsers(query, filters = {}) {
    const { role, department, year, section, page = 1, pageSize = 20 } = filters;
    try {
      let users = await listRecords('users');
      const q = String(query || '').toLowerCase();

      users = users.filter((user) => user.is_active !== false);
      if (q) {
        users = users.filter((user) =>
          String(user.name || '').toLowerCase().includes(q)
          || String(user.registration_number || '').toLowerCase().includes(q)
          || String(user.email || '').toLowerCase().includes(q)
        );
      }
      if (role) users = users.filter((user) => user.role === role);
      if (department) users = users.filter((user) => user.department === department);
      if (year) users = users.filter((user) => String(user.year) === String(year));
      if (section) users = users.filter((user) => user.section === section);

      const offset = (page - 1) * pageSize;
      const sliced = users.slice(offset, offset + pageSize).map((user) => ({
        id: user.id,
        name: user.name,
        registration_number: user.registration_number,
        email: user.email,
        phone: user.phone_number || null,
        department: user.department,
        year: user.year,
        section: user.section,
        role: user.role,
        profile_pic: user.profile_picture || null
      }));

      return {
        success: true,
        users: sliced,
        pagination: {
          page,
          pageSize,
          total: users.length,
          totalPages: Math.ceil(users.length / pageSize)
        }
      };
    } catch (error) {
      console.error('Search users error:', error);
      return { success: false, error: error.message };
    }
  }

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

    try {
      let files = await listRecords('files');
      const q = String(query || '').toLowerCase();

      files = files.filter((file) => file.approved === true);
      if (q) {
        files = files.filter((file) =>
          String(file.original_name || '').toLowerCase().includes(q)
          || String(file.description || '').toLowerCase().includes(q)
        );
      }
      if (category) files = files.filter((file) => file.category === category);
      if (subject) files = files.filter((file) => file.subject === subject);
      if (uploadedBy) files = files.filter((file) => file.uploaded_by === uploadedBy);
      if (startDate) files = files.filter((file) => String(file.created_at || '') >= startDate);
      if (endDate) files = files.filter((file) => String(file.created_at || '') <= endDate);

      const allowedSortFields = ['created_at', 'file_size', 'download_count', 'original_name'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const direction = sortOrder.toUpperCase() === 'ASC' ? 1 : -1;

      files = [...files].sort((left, right) => {
        const leftValue = left[sortField] || '';
        const rightValue = right[sortField] || '';
        if (leftValue === rightValue) return 0;
        return leftValue > rightValue ? direction : -direction;
      });

      const offset = (page - 1) * pageSize;
      return {
        success: true,
        files: files.slice(offset, offset + pageSize),
        pagination: {
          page,
          pageSize,
          total: files.length,
          totalPages: Math.ceil(files.length / pageSize)
        }
      };
    } catch (error) {
      console.error('Search files error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SearchService();
