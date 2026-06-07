# KUPPET Migori - Setup Guide

## Prerequisites
- Node.js >= 18
- MySQL 8.x
- npm

## Quick Start

### 1. Configure Environment
```bash
cp .env.example .env
# Edit .env with your MySQL credentials and other settings
```

### 2. Initialize Database
```bash
# Create database and seed initial data
npm run init-db
# OR manually run:
# mysql -u root -p < backend/config/init.sql
```

### 3. Install & Start
```bash
npm install
npm start         # Production
npm run dev       # Development (auto-reload)
```

Visit: http://localhost:3000

---

## Project Structure

```
KuppetMigori001/
├── backend/
│   ├── config/
│   │   ├── database.js    # MySQL connection pool
│   │   ├── init.sql       # Schema + seed data
│   │   └── initDb.js      # DB init script
│   ├── controllers/       # Business logic
│   ├── middleware/        # JWT auth
│   ├── routes/            # API endpoints
│   └── server.js          # Express app
├── public/
│   ├── css/style.css      # Main stylesheet (1600+ lines)
│   ├── js/
│   │   ├── api.js         # API client
│   │   └── main.js        # Frontend logic
│   ├── pages/             # Inner HTML pages
│   │   ├── about.html
│   │   ├── news.html
│   │   ├── resources.html
│   │   ├── advocacy.html
│   │   ├── scholarships.html
│   │   └── contact.html
│   └── index.html         # Homepage
├── .env.example
└── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/news | All news articles |
| GET | /api/news/featured | Featured articles (3) |
| GET | /api/news/:slug | Single article |
| GET | /api/events | All events |
| GET | /api/events/upcoming | Upcoming events |
| GET | /api/resources | Teaching resources |
| GET | /api/resources/:id/download | Download tracking |
| GET | /api/leadership | Branch officials |
| GET | /api/scholarships | Scholarships |
| GET | /api/advocacy | Advocacy content |
| GET | /api/settings/stats | Site statistics |
| POST | /api/contact | Contact form |
| GET | /api/health | Health check |

## Default Admin
- Email: admin@kuppetmigori.org
- Password: Admin@123 (**CHANGE IN PRODUCTION**)

## To-Do Before Deployment
- [ ] Change all placeholder phone numbers and emails in HTML files
- [ ] Upload real leader photos to public/images/
- [ ] Configure SMTP in .env for email notifications
- [ ] Add Google Maps API key for embedded map
- [ ] Set NODE_ENV=production in .env
- [ ] Configure SSL/HTTPS
- [ ] Run: `npm audit fix`
