# 🚀 Caching Quick Start Guide

Quick reference for implementing and using the enhanced caching system.

## 🎯 Quick Overview

The system now uses:
- **Redis** (Production) / **node-cache** (Development)
- **Service Worker** with stale-while-revalidate
- **CDN Headers** for static assets
- **Route-level caching** for analytics

## 🏃 Getting Started

### Development (No Setup Required)

```bash
# Just run the app - uses in-memory cache automatically
npm run dev
```

### Production Setup

1. **Add Redis to your platform:**

   **Vercel + Upstash:**
   ```bash
   # Add to Vercel Environment Variables
   REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
   ```

   **Railway:**
   ```bash
   # Add Redis plugin - REDIS_URL is auto-set
   ```

   **Render/Heroku:**
   ```bash
   # Add Redis addon and copy REDIS_URL
   ```

2. **Deploy** - That's it! The system auto-detects Redis.

## 📝 Usage Examples

### Basic Caching

```javascript
const cacheService = require('./services/cache.service');

// Cache for 10 minutes
await cacheService.set('my-key', data, 600);

// Get from cache
const data = await cacheService.get('my-key');

// Cache or fetch pattern
const data = await cacheService.getOrSet('my-key', async () => {
  return await fetchFromDB();
}, 600);
```

### Route Caching

```javascript
const { analyticsCacheMiddleware } = require('./middleware/cache.middleware');

// Add to route - caches for 10 minutes
router.get('/analytics', 
  authMiddleware,
  analyticsCacheMiddleware(600),
  handler
);
```

### Cache Invalidation

```javascript
// Invalidate specific key
await cacheService.del('user:123');

// Invalidate by pattern
await cacheService.invalidatePattern('user:123');

// Invalidate all analytics
await cacheService.invalidateAnalytics();
```

## 🔧 Configuration

### Cache TTL Recommendations

| Data Type | TTL | Example |
|-----------|-----|---------|
| Real-time | 0-60s | Messages, notifications |
| Dynamic | 1-5 min | Dashboard stats |
| Analytics | 5-15 min | Reports, charts |
| Static | 1+ hour | Timetables, menus |
| Permanent | 1+ day | Icons, policies |

### Service Worker

Automatically caches:
- ✅ Static assets (CSS, JS, images)
- ✅ Analytics APIs (stale-while-revalidate)
- ✅ HTML pages (network-first)

### CDN (Cloudflare)

Already configured in `vercel.json`:
- Static assets: 1 year cache
- HTML: No cache (always fresh)
- API: No cache

## 🐛 Troubleshooting

### Check Cache Status

```javascript
// In your route or console
const stats = cacheService.getStats();
console.log('Cache type:', stats.type); // 'redis' or 'node-cache'
console.log('Connected:', stats.connected);
```

### Clear Cache

```javascript
// Clear all caches
await cacheService.flush();
```

### Environment Check

```bash
# Check if Redis is configured
echo $REDIS_URL

# Check connection
node -e "const { isRedisConnected } = require('./server/config/redis.config'); console.log('Redis:', isRedisConnected());"
```

## 📊 Monitoring

### Cache Hit Rate

```javascript
const stats = cacheService.getStats();
const hitRate = stats.main.hits / (stats.main.hits + stats.main.misses);
console.log(`Hit rate: ${(hitRate * 100).toFixed(2)}%`);
```

## 🎓 Key Features

### ✅ Automatic Fallback
- Redis in production
- node-cache in development
- No code changes needed

### ✅ Smart Invalidation
- Automatic on POST/PUT/DELETE
- Pattern-based invalidation
- User-specific cache clearing

### ✅ Optimized TTL
- Different TTL for different data types
- Analytics: 10 minutes
- Static: 1 hour
- Session: 30 minutes

### ✅ Service Worker
- Offline support
- Stale-while-revalidate for APIs
- Background updates

## 📚 Full Documentation

For complete details, see [CACHING_GUIDE.md](./CACHING_GUIDE.md)

## 🎯 Common Use Cases

### 1. Cache User Profile

```javascript
// Set
await cacheService.setUserData(userId, profileData, 600);

// Get
const profile = await cacheService.getUserData(userId);

// Invalidate on update
await cacheService.invalidateUserData(userId);
```

### 2. Cache Analytics

```javascript
// Set
await cacheService.setAnalytics('performance', { studentId }, data, 600);

// Get
const analytics = await cacheService.getAnalytics('performance', { studentId });

// Invalidate all analytics
await cacheService.invalidateAnalytics();
```

### 3. Cache API Response

```javascript
const { cacheMiddleware } = require('./middleware/cache.middleware');

router.get('/expensive-query',
  authMiddleware,
  cacheMiddleware({ ttl: 300 }), // 5 minutes
  async (req, res) => {
    const data = await expensiveQuery();
    res.json({ success: true, data });
  }
);
```

## 🚀 Performance Impact

Expected improvements:
- **90% faster** cached query responses
- **50% reduction** in database load
- **Better UX** with instant responses
- **Offline support** via service worker

## 💡 Tips

1. **Use appropriate TTL** - Don't cache too long or too short
2. **Invalidate on mutations** - Clear cache when data changes
3. **Monitor hit rates** - Aim for >70% hit rate
4. **Pattern keys carefully** - Make them unique but predictable
5. **Test offline** - Verify service worker works

## ⚠️ Important Notes

- Redis is **optional** - works without it in development
- Service worker requires **HTTPS** in production
- Cache invalidation is **automatic** for mutations
- Statistics are **real-time**
- Fallback to node-cache is **seamless**

## 🎉 Success Indicators

You'll know it's working when:
- Server logs show `[Redis] Connected successfully` (production)
- Or shows `Running in development mode - using in-memory cache`
- API responses are faster on repeat requests
- Service worker is registered in browser DevTools
- Cache statistics show high hit rates

---

**Need Help?** Check the [Full Caching Guide](./CACHING_GUIDE.md) or open an issue.
