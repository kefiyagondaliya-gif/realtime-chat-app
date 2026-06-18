# ChatFlow — Real-Time Chat Application

A full-stack real-time chat application built with the MERN stack and Socket.io.

## Features

- Real-time messaging using WebSockets (Socket.io)
- User authentication with JWT
- Multiple chat rooms support
- Online/offline user status
- Responsive UI built with React and Tailwind CSS
- RESTful API backend with Express.js
- MongoDB database with Mongoose

## Tech Stack

**Frontend**
- React.js
- Tailwind CSS
- Socket.io-client

**Backend**
- Node.js
- Express.js
- Socket.io
- MongoDB + Mongoose
- JWT Authentication

## Project Structure

```
ChatFlow-improved/
├── backend/          # Node.js + Express + Socket.io server
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── server.js
└── chatflow/         # React frontend
    ├── public/
    └── src/
```

## Getting Started

### Prerequisites
- Node.js
- MongoDB

### Installation

**Backend**
```bash
cd backend
npm install
```

Create `.env` file in `backend/`:
```
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

```bash
npm start
```

**Frontend**
```bash
cd chatflow
npm install
npm run dev
```

## Live Demo

Coming soon

## Author

**Kaifiya Gondaliya**  
MERN Stack Developer  
[GitHub](https://github.com/kefiyagondaliya-gif) · [LinkedIn](https://www.linkedin.com/in/kaifiya-gondaliya-40a744369/)