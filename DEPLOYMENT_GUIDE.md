# 🚀 DEPLOYMENT GUIDE - FREE PLATFORMS

**Target Platforms**: Render (Backend) | Vercel (Frontend) | MongoDB Atlas (Database)

---

## 📋 PRE-DEPLOYMENT CHECKLIST

- [ ] All code tested locally
- [ ] Environment variables documented
- [ ] Dependencies in package.json
- [ ] GitHub repository ready
- [ ] API keys secured (never in code)

---

## 1️⃣ MONGODB ATLAS (Free Tier)

### **Setup Steps**

1. **Create Account**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up with email
   - Click "Create free account"

2. **Create Cluster**
   - Choose "AWS" as provider
   - Select free tier (M0)
   - Choose region closest to you
   - Create cluster (wait 5-10 minutes)

3. **Configure Network Access**
   - Go to "Network Access"
   - Click "Add IP Address"
   - Select "Allow access from anywhere" (0.0.0.0/0)
   - Click "Confirm"

4. **Create Database User**
   - Go to "Database Access"
   - Click "Add New Database User"
   - Username: `stock_user`
   - Password: Generate strong password
   - Click "Create User"

5. **Get Connection String**
   - Go back to "Clusters"
   - Click "Connect"
   - Choose "Connect your application"
   - Copy connection string
   - Replace `<password>` and `<database>` with real values

### **Connection String Format**
```
mongodb+srv://stock_user:PASSWORD@cluster0.xxxxx.mongodb.net/stock-db?retryWrites=true&w=majority
```

### **Add to Backend .env**
```env
MONGODB_URI=mongodb+srv://stock_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/stock-db
```

---

## 2️⃣ RENDER BACKEND DEPLOYMENT

### **Setup Steps**

1. **Create Render Account**
   - Go to https://render.com
   - Click "Sign up"
   - Sign in with GitHub preferred

2. **Connect GitHub Repository**
   - Click "New +"
   - Select "Web Service"
   - Click "Connect Repository"
   - Select your stock-tracker repo
   - Click "Connect"

3. **Configure Web Service**
   - **Name**: `stock-intelligence-backend`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid if needed)

4. **Add Environment Variables**
   - Click "Advanced"
   - Click "Add Environment Variable"
   - Add the following:
     ```
     PORT=5000
     MONGODB_URI=mongodb+srv://stock_user:PASSWORD@cluster0.xxxxx.mongodb.net/stock-db
     JWT_SECRET=your_secret_key_here_min_32_chars
     NODE_ENV=production
     ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (2-3 minutes)
   - Copy the deployed URL (e.g., `https://stock-intelligence-backend.onrender.com`)

### **Important: Free Tier Limitations**
- Server spins down after 15 minutes of inactivity
- Recommended: Add health check or frequent pings
- Consider paid tier ($7/month) for production

### **Add Health Check**
- In Render dashboard, add health check:
  - **Path**: `/health`
  - **Check Interval**: 5 minutes

---

## 3️⃣ VERCEL FRONTEND DEPLOYMENT

### **Setup Steps**

1. **Create Vercel Account**
   - Go to https://vercel.com
   - Sign up with GitHub
   - Authorize Vercel for GitHub access

2. **Import Project**
   - Click "New Project"
   - Select your GitHub repository
   - Click "Import"

3. **Configure Project**
   - **Framework**: Vite
   - **Root Directory**: `./frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. **Add Environment Variables**
   - Under "Environment Variables", add:
     ```
     VITE_API_BASE=https://stock-intelligence-backend.onrender.com/api
     ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build & deployment (2-3 minutes)
   - Access your app at the Vercel URL

### **Setup Custom Domain** (Optional)
- In Vercel Dashboard → Settings → Domains
- Add your custom domain
- Follow DNS configuration

---

## 4️⃣ UPDATE APPLICATION ENDPOINTS

### **Frontend Configuration**

After deployment, update your frontend to use production URLs:

**File**: `frontend/src/main.jsx` or create `.env.production`

```javascript
// Development
const API_BASE = 'http://localhost:5000/api';

// Production (Vercel)
const API_BASE = 'https://stock-intelligence-backend.onrender.com/api';
```

### **WebSocket Connection**

**File**: `frontend/src/pages/PaperTradingPage.jsx` (or any component using WebSocket)

```javascript
// Development
const socket = io('http://localhost:5000');

// Production
const socket = io('https://stock-intelligence-backend.onrender.com', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});
```

---

## 5️⃣ TESTING PRODUCTION DEPLOYMENT

### **Backend Tests**
```bash
# Check health endpoint
curl https://stock-intelligence-backend.onrender.com/health

# Test API endpoint
curl https://stock-intelligence-backend.onrender.com/api/market
```

### **Frontend Tests**
- Visit your Vercel URL
- Test paper trading (buy/sell)
- Test analytics page
- Verify real-time updates

### **Database Tests**
```javascript
// Verify MongoDB connection in backend logs
// Look for: "✅ MongoDB Connected"
```

---

## 🔄 CONTINUOUS DEPLOYMENT

### **Automatic Deployments**
- **Render**: Auto-deploys on git push to main
- **Vercel**: Auto-deploys on git push to main

### **Manual Redeployment**

**Render Backend:**
1. Go to Render Dashboard
2. Select your service
3. Click "Manual Deploy" → "Deploy Latest Commit"

**Vercel Frontend:**
1. Go to Vercel Dashboard
2. Select your project
3. Click "Redeploy"

---

## 📊 MONITORING & MAINTENANCE

### **Render Monitoring**
- Logs accessible in Render Dashboard
- Check for errors/warnings
- Monitor CPU/Memory usage

### **Vercel Monitoring**
- Real-time analytics available
- Monitor build times
- Check function logs

### **MongoDB Monitoring**
- Go to MongoDB Atlas Dashboard
- Check cluster status
- Monitor storage usage (512MB free limit)
- Optimize queries if needed

---

## ⚡ OPTIMIZATION FOR FREE TIER

### **Render (Backend)**
- Keep response times under 30 seconds
- Implement data caching where possible
- Avoid heavy computations on-demand
- Consider queuing for background jobs

### **Vercel (Frontend)**
- Optimize bundle size (next.js/vite)
- Use image optimization
- Implement code splitting
- Cache static assets

### **MongoDB**
- Create indexes for frequently queried fields
- Limit query results with pagination
- Archive old data regularly
- Monitor storage usage

---

## 🔐 SECURITY CHECKLIST

- [ ] HTTPS enabled on all services
- [ ] CORS properly configured
- [ ] Environment variables secured (not in code)
- [ ] Database users have strong passwords
- [ ] API rate limiting configured (if applicable)
- [ ] HTTPS enforced in frontend
- [ ] Sensitive data not logged

---

## 🆘 TROUBLESHOOTING

### **Backend Not Starting**
```
Solution: Check build logs in Render
- Ensure all dependencies in package.json
- Check Node version compatibility
- Verify build command
```

### **Frontend Blank Page**
```
Solution: Check browser console for errors
- Verify VITE_API_BASE is correct
- Check API connectivity
- Clear browser cache
```

### **WebSocket Not Connecting**
```
Solution: Check CORS and WebSocket configuration
- Verify socket.io server is running
- Check firewall rules
- Test with: npm run dev (local)
```

### **Database Connection Failed**
```
Solution: Verify MongoDB connection
- Check connection string in .env
- Verify IP whitelisting
- Test with MongoDB Atlas console
```

---

## 📈 UPGRADING TO PAID TIER

### **When to Upgrade**
- Production traffic exceeds free tier limits
- Need more database storage (>512MB)
- Require faster response times
- Need priority support

### **Render Pricing**
- Paid tier starts at $7/month
- Includes 0.5GB RAM, no spin-down

### **MongoDB Atlas Pricing**
- Paid tier starts at $0.10/month
- M2 tier with more storage & performance

### **Vercel Pricing**
- Pro tier at $20/month
- Includes priority support & higher limits

---

## 🎓 BEST PRACTICES

1. **Always test locally first** before deploying
2. **Use environment variables** for secrets
3. **Monitor logs regularly** for issues
4. **Keep dependencies updated** (monthly)
5. **Backup data** regularly from MongoDB
6. **Track costs** on free tier services
7. **Document deployment process** for team
8. **Set up error tracking** (optional: Sentry)

---

## 📞 SUPPORT RESOURCES

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Docs**: https://docs.mongodb.com
- **Socket.io Docs**: https://socket.io/docs
- **Express Docs**: https://expressjs.com

---

**Deployment Status**: Ready for Implementation  
**Expected Time**: 30-45 minutes for full setup  
**Maintenance**: ~15 minutes/week for monitoring
