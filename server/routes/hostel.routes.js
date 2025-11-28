const express = require('express');
const router = express.Router();
const { db } = require('../database/firebase');

// Helper to get demo hostel menu
const getDemoHostelMenu = (startDate, days = 1) => {
  const breakfastItems = ['Idli Sambar', 'Poha', 'Upma', 'Paratha with Curd', 'Bread Toast & Jam', 'Aloo Paratha'];
  const lunchItems = ['Rice, Dal, Sabji, Roti', 'Biryani with Raita', 'Chole Bhature', 'Rajma Chawal', 'Paneer Curry with Rice'];
  const snacksItems = ['Samosa', 'Pakora', 'Sandwich', 'Biscuits & Tea', 'Fruit', 'Vada Pav'];
  const dinnerItems = ['Roti, Dal, Rice, Sabji', 'Noodles with Manchurian', 'Fried Rice', 'Pulao with Raita', 'Mixed Vegetables with Chapati'];
  
  const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  const menu = [];
  const date = new Date(startDate);
  
  for (let d = 0; d < days; d++) {
    const currentDate = new Date(date);
    currentDate.setDate(currentDate.getDate() + d);
    const dateStr = currentDate.toISOString().split('T')[0];
    
    menu.push(
      { id: menu.length + 1, date: dateStr, meal_type: 'breakfast', menu_items: getRandomItem(breakfastItems) },
      { id: menu.length + 2, date: dateStr, meal_type: 'lunch', menu_items: getRandomItem(lunchItems) },
      { id: menu.length + 3, date: dateStr, meal_type: 'snacks', menu_items: getRandomItem(snacksItems) },
      { id: menu.length + 4, date: dateStr, meal_type: 'dinner', menu_items: getRandomItem(dinnerItems) }
    );
  }
  
  return menu;
};

// Get hostel menu
router.get('/menu', async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    try {
      const menuSnapshot = await db.collection('hostel_menu')
        .where('date', '==', targetDate)
        .get();
      
      if (!menuSnapshot.empty) {
        const menu = [];
        menuSnapshot.forEach(doc => {
          menu.push({ id: doc.id, ...doc.data() });
        });
        // Sort by meal type
        const mealOrder = { 'breakfast': 1, 'lunch': 2, 'snacks': 3, 'dinner': 4 };
        menu.sort((a, b) => (mealOrder[a.meal_type] || 5) - (mealOrder[b.meal_type] || 5));
        return res.json({ success: true, data: menu });
      }
    } catch (firestoreError) {
      console.warn('Firestore hostel menu error:', firestoreError.message);
    }
    
    // Fallback to demo data
    res.json({ success: true, data: getDemoHostelMenu(targetDate, 1) });
  } catch (error) {
    console.error('Get hostel menu error:', error.message);
    res.json({ success: true, data: getDemoHostelMenu(new Date().toISOString().split('T')[0], 1) });
  }
});

// Get menu for week
router.get('/menu/week', async (req, res, next) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    const weekLaterStr = weekLater.toISOString().split('T')[0];
    
    try {
      const menuSnapshot = await db.collection('hostel_menu')
        .where('date', '>=', todayStr)
        .where('date', '<=', weekLaterStr)
        .get();
      
      if (!menuSnapshot.empty) {
        const menu = [];
        menuSnapshot.forEach(doc => {
          menu.push({ id: doc.id, ...doc.data() });
        });
        // Sort by date and meal type
        const mealOrder = { 'breakfast': 1, 'lunch': 2, 'snacks': 3, 'dinner': 4 };
        menu.sort((a, b) => {
          const dateDiff = new Date(a.date) - new Date(b.date);
          if (dateDiff !== 0) return dateDiff;
          return (mealOrder[a.meal_type] || 5) - (mealOrder[b.meal_type] || 5);
        });
        return res.json({ success: true, data: menu });
      }
    } catch (firestoreError) {
      console.warn('Firestore hostel week menu error:', firestoreError.message);
    }
    
    // Fallback to demo data
    res.json({ success: true, data: getDemoHostelMenu(todayStr, 7) });
  } catch (error) {
    console.error('Get week menu error:', error.message);
    res.json({ success: true, data: getDemoHostelMenu(new Date().toISOString().split('T')[0], 7) });
  }
});

module.exports = router;
