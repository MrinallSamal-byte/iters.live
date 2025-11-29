const express = require('express');
const router = express.Router();
const { db } = require('../database/firebase');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

/**
 * Menu System Routes
 * Collection: menus
 * 
 * Document structure:
 * {
 *   menu_date: string (YYYY-MM-DD format),
 *   hostel_type: string (e.g., 'boys', 'girls'),
 *   hostel_name: string (e.g., 'BH1', 'LH2'),
 *   breakfast: string (comma-separated items),
 *   lunch: string (comma-separated items),
 *   snacks: string (comma-separated items),
 *   dinner: string (comma-separated items),
 *   created_at: timestamp,
 *   updated_at: timestamp,
 *   created_by: string (user id)
 * }
 */

// Helper function to get formatted date string
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
};

/**
 * GET /api/menu/date/:date
 * Fetch menu for specific date and hostel
 * Query params: hostel (optional) - filter by hostel_name
 */
router.get('/date/:date', async (req, res, next) => {
  try {
    const { date } = req.params;
    const { hostel } = req.query;
    
    const formattedDate = formatDate(date);
    if (!formattedDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    let query = db.collection('menus').where('menu_date', '==', formattedDate);
    
    if (hostel) {
      query = query.where('hostel_name', '==', hostel);
    }

    const snapshot = await query.get();
    
    const menus = [];
    snapshot.forEach(doc => {
      menus.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      data: menus
    });
  } catch (error) {
    console.error('Error fetching menu by date:', error);
    next(error);
  }
});

/**
 * GET /api/menu/range
 * Fetch menus for date range
 * Query params: startDate, endDate, hostel (optional)
 */
router.get('/range', async (req, res, next) => {
  try {
    const { startDate, endDate, hostel } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }

    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);
    
    if (!formattedStartDate || !formattedEndDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    let query = db.collection('menus')
      .where('menu_date', '>=', formattedStartDate)
      .where('menu_date', '<=', formattedEndDate);
    
    const snapshot = await query.get();
    
    let menus = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Filter by hostel if provided (after query since Firestore has limitations on multiple where clauses)
      if (!hostel || data.hostel_name === hostel) {
        menus.push({
          id: doc.id,
          ...data
        });
      }
    });

    // Sort by date
    menus.sort((a, b) => a.menu_date.localeCompare(b.menu_date));

    res.json({
      success: true,
      data: menus
    });
  } catch (error) {
    console.error('Error fetching menu range:', error);
    next(error);
  }
});

/**
 * GET /api/menu/hostels
 * Get list of available hostels
 */
router.get('/hostels', async (req, res, next) => {
  try {
    // Return predefined hostel list
    const hostels = {
      girls: [
        { name: 'LH1', displayName: 'Ladies Hostel 1' },
        { name: 'LH2', displayName: 'Ladies Hostel 2' },
        { name: 'LH3', displayName: 'Ladies Hostel 3' },
        { name: 'LH4', displayName: 'Ladies Hostel 4' }
      ],
      boys: [
        { name: 'BH1', displayName: 'Boys Hostel 1' },
        { name: 'BH2', displayName: 'Boys Hostel 2' },
        { name: 'BH3', displayName: 'Boys Hostel 3' },
        { name: 'BH4', displayName: 'Boys Hostel 4' },
        { name: 'BH5', displayName: 'Boys Hostel 5' },
        { name: 'BH6', displayName: 'Boys Hostel 6' },
        { name: 'BH7', displayName: 'Boys Hostel 7' },
        { name: 'BH8', displayName: 'Boys Hostel 8' },
        { name: 'BH9', displayName: 'Boys Hostel 9' },
        { name: 'BH10', displayName: 'Boys Hostel 10' },
        { name: 'BH11', displayName: 'Boys Hostel 11' },
        { name: 'BH12', displayName: 'Boys Hostel 12' }
      ]
    };

    res.json({
      success: true,
      data: hostels
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/menu
 * Create new menu (Admin only)
 * Body: { menu_date, hostel_type, hostel_name, breakfast, lunch, snacks, dinner }
 */
router.post('/', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { menu_date, hostel_type, hostel_name, breakfast, lunch, snacks, dinner } = req.body;

    // Validation
    if (!menu_date || !hostel_name) {
      return res.status(400).json({
        success: false,
        message: 'menu_date and hostel_name are required'
      });
    }

    const formattedDate = formatDate(menu_date);
    if (!formattedDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Check for duplicate (same date + hostel)
    const existingQuery = await db.collection('menus')
      .where('menu_date', '==', formattedDate)
      .where('hostel_name', '==', hostel_name)
      .get();

    if (!existingQuery.empty) {
      return res.status(409).json({
        success: false,
        message: 'Menu for this date and hostel already exists. Use PUT to update.'
      });
    }

    const menuData = {
      menu_date: formattedDate,
      hostel_type: hostel_type || 'general',
      hostel_name,
      breakfast: breakfast || '',
      lunch: lunch || '',
      snacks: snacks || '',
      dinner: dinner || '',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: req.user.id || null
    };

    const docRef = await db.collection('menus').add(menuData);

    res.status(201).json({
      success: true,
      message: 'Menu created successfully',
      data: {
        id: docRef.id,
        ...menuData
      }
    });
  } catch (error) {
    console.error('Error creating menu:', error);
    next(error);
  }
});

/**
 * PUT /api/menu/:id
 * Update existing menu (Admin only)
 * Body: { menu_date, hostel_type, hostel_name, breakfast, lunch, snacks, dinner }
 */
router.put('/:id', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { menu_date, hostel_type, hostel_name, breakfast, lunch, snacks, dinner } = req.body;

    // Check if menu exists
    const menuRef = db.collection('menus').doc(id);
    const menuDoc = await menuRef.get();

    if (!menuDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Menu not found'
      });
    }

    const updateData = {
      updated_at: new Date()
    };

    if (menu_date) {
      const formattedDate = formatDate(menu_date);
      if (!formattedDate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD'
        });
      }
      updateData.menu_date = formattedDate;
    }

    if (hostel_type !== undefined) updateData.hostel_type = hostel_type;
    if (hostel_name !== undefined) updateData.hostel_name = hostel_name;
    if (breakfast !== undefined) updateData.breakfast = breakfast;
    if (lunch !== undefined) updateData.lunch = lunch;
    if (snacks !== undefined) updateData.snacks = snacks;
    if (dinner !== undefined) updateData.dinner = dinner;

    await menuRef.update(updateData);

    const updatedDoc = await menuRef.get();

    res.json({
      success: true,
      message: 'Menu updated successfully',
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });
  } catch (error) {
    console.error('Error updating menu:', error);
    next(error);
  }
});

/**
 * DELETE /api/menu/:id
 * Delete menu (Admin only)
 */
router.delete('/:id', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if menu exists
    const menuRef = db.collection('menus').doc(id);
    const menuDoc = await menuRef.get();

    if (!menuDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Menu not found'
      });
    }

    await menuRef.delete();

    res.json({
      success: true,
      message: 'Menu deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting menu:', error);
    next(error);
  }
});

/**
 * POST /api/menu/copy
 * Copy menu from one date to another (Admin only)
 * Body: { sourceDate, targetDate, hostel (optional) }
 */
router.post('/copy', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { sourceDate, targetDate, hostel } = req.body;

    if (!sourceDate || !targetDate) {
      return res.status(400).json({
        success: false,
        message: 'sourceDate and targetDate are required'
      });
    }

    const formattedSourceDate = formatDate(sourceDate);
    const formattedTargetDate = formatDate(targetDate);

    if (!formattedSourceDate || !formattedTargetDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Get source menus
    let query = db.collection('menus').where('menu_date', '==', formattedSourceDate);
    const sourceSnapshot = await query.get();

    if (sourceSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'No menus found for the source date'
      });
    }

    const batch = db.batch();
    let copiedCount = 0;

    for (const doc of sourceSnapshot.docs) {
      const sourceMenu = doc.data();
      
      // Filter by hostel if specified
      if (hostel && sourceMenu.hostel_name !== hostel) {
        continue;
      }

      // Check if target already exists
      const existingQuery = await db.collection('menus')
        .where('menu_date', '==', formattedTargetDate)
        .where('hostel_name', '==', sourceMenu.hostel_name)
        .get();

      if (existingQuery.empty) {
        const newMenuRef = db.collection('menus').doc();
        batch.set(newMenuRef, {
          ...sourceMenu,
          menu_date: formattedTargetDate,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: req.user.id || null
        });
        copiedCount++;
      }
    }

    if (copiedCount > 0) {
      await batch.commit();
    }

    res.json({
      success: true,
      message: `${copiedCount} menu(s) copied successfully`,
      data: {
        copiedCount
      }
    });
  } catch (error) {
    console.error('Error copying menu:', error);
    next(error);
  }
});

/**
 * POST /api/menu/bulk
 * Bulk create menus from CSV data (Admin only)
 * Body: { menus: [{ menu_date, hostel_type, hostel_name, breakfast, lunch, snacks, dinner }] }
 */
router.post('/bulk', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { menus } = req.body;

    if (!menus || !Array.isArray(menus) || menus.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'menus array is required'
      });
    }

    const batch = db.batch();
    const results = {
      created: 0,
      skipped: 0,
      errors: []
    };

    for (let i = 0; i < menus.length; i++) {
      const menu = menus[i];
      
      if (!menu.menu_date || !menu.hostel_name) {
        results.errors.push(`Row ${i + 1}: menu_date and hostel_name are required`);
        results.skipped++;
        continue;
      }

      const formattedDate = formatDate(menu.menu_date);
      if (!formattedDate) {
        results.errors.push(`Row ${i + 1}: Invalid date format`);
        results.skipped++;
        continue;
      }

      // Check for existing
      const existingQuery = await db.collection('menus')
        .where('menu_date', '==', formattedDate)
        .where('hostel_name', '==', menu.hostel_name)
        .get();

      if (!existingQuery.empty) {
        results.errors.push(`Row ${i + 1}: Menu already exists for ${formattedDate} - ${menu.hostel_name}`);
        results.skipped++;
        continue;
      }

      const newMenuRef = db.collection('menus').doc();
      batch.set(newMenuRef, {
        menu_date: formattedDate,
        hostel_type: menu.hostel_type || 'general',
        hostel_name: menu.hostel_name,
        breakfast: menu.breakfast || '',
        lunch: menu.lunch || '',
        snacks: menu.snacks || '',
        dinner: menu.dinner || '',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: req.user.id || null
      });
      results.created++;
    }

    if (results.created > 0) {
      await batch.commit();
    }

    res.json({
      success: true,
      message: `Bulk operation completed: ${results.created} created, ${results.skipped} skipped`,
      data: results
    });
  } catch (error) {
    console.error('Error bulk creating menus:', error);
    next(error);
  }
});

/**
 * GET /api/menu/all
 * Get all menus with optional pagination (Admin only)
 * Query params: limit, startAfter
 */
router.get('/all', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    
    let query = db.collection('menus')
      .orderBy('menu_date', 'desc')
      .limit(parseInt(limit));

    const snapshot = await query.get();
    
    const menus = [];
    snapshot.forEach(doc => {
      menus.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      data: menus
    });
  } catch (error) {
    console.error('Error fetching all menus:', error);
    next(error);
  }
});

module.exports = router;
