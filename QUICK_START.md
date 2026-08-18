# 1. Navigate to project
cd /home/claude/inbox-hub-backend

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env

# 4. Start MongoDB (Terminal 1)
mongod

# 5. Initialize database (Terminal 2)
node scripts/init-db.js

# 6. Start server (Terminal 2 or 3)
npm run dev

# 7. Test it (Terminal 3)
curl http://localhost:5000/api/health