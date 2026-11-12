# Blog REST API - Beginner-Friendly Backend Mini Project

A complete RESTful API backend for a Blog platform built with **Node.js**, **Express.js**, **MongoDB**, and **Mongoose**, featuring **JWT authentication stored in HTTP-only cookies**, **password hashing with bcrypt**, and **author-based authorization for CRUD operations**.

Based on the [Beginner Blog REST API Guide](https://github.com/rishabjha1234/CORE-F/blob/main/Most_Asked_Interview_Questions/Beginner_Blog_REST_API_Guide.pdf).

---

## 🚀 Features

- **Health Check API**: Verifies that the server is alive and responding.
- **User Authentication**:
  - Secure registration (`/api/auth/signup`) with bcrypt password hashing (10 salt rounds) and duplicate email check (409 Conflict).
  - Secure login (`/api/auth/login`) with credential verification and signed JWT token issued via an **HTTP-only cookie** (1 day expiry, `sameSite: "lax"`).
  - Logout (`/api/auth/logout`) which clears the authentication cookie.
- **Protected Blog CRUD**:
  - **Create Blog**: Authenticated users can create blogs; author ID is automatically attached from the JWT token.
  - **Read Blogs**: Public endpoints to get all blogs (sorted newest first, populated with author name & email) and get a single blog by ID.
  - **Update Blog**: Author-only permission check (`403 Forbidden` if another user attempts). Validates input and updates title/content.
  - **Delete Blog**: Author-only permission check (`403 Forbidden` if not the owner).
- **Error Handling**: Handles invalid ObjectIds (`CastError` -> `400 Bad Request`), duplicate keys (`11000` -> `409 Conflict`), and missing/malformed fields.

---

## 📁 Project Structure

```text
Blog_Rest_api/
├── config/
│   └── db.js                 # MongoDB connection handler via Mongoose
├── controllers/
│   ├── authController.js     # Signup, login, and logout logic
│   └── blogController.js     # Blog CRUD operations & ownership checks
├── middleware/
│   └── authMiddleware.js     # Validates JWT stored in req.cookies.token
├── models/
│   ├── User.js               # User Mongoose schema (name, email, password)
│   └── Blog.js               # Blog Mongoose schema (title, content, author)
├── routes/
│   ├── authRoutes.js         # Routes mapped to authController
│   └── blogRoutes.js         # Routes mapped to blogController
├── .env                      # Environment variables (PORT, MONGO_URI, JWT_SECRET)
├── .env.example              # Sample environment configuration template
├── .gitignore                # Git ignore rules (node_modules, .env)
├── package.json              # Project dependencies & scripts
├── postman_collection.json   # Ready-to-import Postman collection
├── guide.pdf                 # Original PDF guide
└── server.js                 # Express server bootstrap & route mounting
```

---

## 🛠️ Prerequisites

- **Node.js** (v18+ or LTS)
- **npm** (comes with Node.js)
- **MongoDB** running locally (`mongodb://127.0.0.1:27017`) or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster
- **Postman** (for API testing)

---

## ⚙️ Installation & Setup

1. **Clone or enter the project directory**:
   ```bash
   cd Blog_Rest_api
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   A `.env` file is already created. You can adjust the values as needed:
   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/blogDB
   JWT_SECRET=super_secret_jwt_key_blog_api_learning_project_12345
   ```
   > **Note for MongoDB Atlas users**: Replace `MONGO_URI` with your connection string (e.g. `mongodb+srv://<user>:<password>@cluster0.mongodb.net/blogDB?retryWrites=true&w=majority`).

---

## ▶️ Running the Application

### Development Mode (with automatic restart via nodemon):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

Expected terminal output:
```text
MongoDB connected successfully
Server running at http://localhost:5000
```

---

## 📡 API Reference

Base URL: `http://localhost:5000`

### 1. Health API
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Checks if the API is running |

**Response (200 OK):**
```json
{
  "message": "Blog API is running"
}
```

---

### 2. Authentication APIs

#### A. Signup
- **Endpoint**: `POST /api/auth/signup`
- **Access**: Public
- **Body**:
  ```json
  {
    "name": "Rohan",
    "email": "rohan@example.com",
    "password": "rohan123"
  }
  ```
- **Responses**:
  - `201 Created`: User registered successfully
  - `400 Bad Request`: Missing fields or password shorter than 6 characters
  - `409 Conflict`: Email already registered

#### B. Login
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public
- **Body**:
  ```json
  {
    "email": "rohan@example.com",
    "password": "rohan123"
  }
  ```
- **Responses**:
  - `200 OK`: Sets `token` HTTP-only cookie and returns user object
  - `400 Bad Request`: Missing email or password
  - `401 Unauthorized`: Invalid email or password

#### C. Logout
- **Endpoint**: `POST /api/auth/logout`
- **Access**: Public
- **Response**:
  - `200 OK`: Clears `token` cookie (`Logout successful`)

---

### 3. Blog APIs

#### A. Create Blog
- **Endpoint**: `POST /api/blogs`
- **Access**: **Private** (Requires valid login cookie)
- **Body**:
  ```json
  {
    "title": "My First Blog",
    "content": "I am learning Express."
  }
  ```
- **Responses**:
  - `201 Created`: Returns created blog with `author` ID
  - `400 Bad Request`: Title or content missing / empty
  - `401 Unauthorized`: Not logged in / missing token

#### B. Get All Blogs
- **Endpoint**: `GET /api/blogs`
- **Access**: Public
- **Response (200 OK)**:
  ```json
  {
    "count": 1,
    "blogs": [
      {
        "_id": "67...a1",
        "title": "My First Blog",
        "content": "I am learning Express.",
        "author": {
          "_id": "67...01",
          "name": "Rohan",
          "email": "rohan@example.com"
        },
        "createdAt": "2026-...",
        "updatedAt": "2026-..."
      }
    ]
  }
  ```

#### C. Get One Blog by ID
- **Endpoint**: `GET /api/blogs/:id`
- **Access**: Public
- **Responses**:
  - `200 OK`: Returns single blog with populated author
  - `400 Bad Request`: Invalid MongoDB ID format (`CastError`)
  - `404 Not Found`: Blog does not exist

#### D. Update Blog
- **Endpoint**: `PUT /api/blogs/:id`
- **Access**: **Private (Author Only)**
- **Body**:
  ```json
  {
    "title": "Updated Blog",
    "content": "I finished the project."
  }
  ```
- **Responses**:
  - `200 OK`: Returns updated blog
  - `400 Bad Request`: No fields provided or invalid strings
  - `401 Unauthorized`: Not logged in
  - `403 Forbidden`: Authenticated user is not the blog's author
  - `404 Not Found`: Blog not found

#### E. Delete Blog
- **Endpoint**: `DELETE /api/blogs/:id`
- **Access**: **Private (Author Only)**
- **Responses**:
  - `200 OK`: `{"message": "Blog deleted successfully"}`
  - `401 Unauthorized`: Not logged in
  - `403 Forbidden`: Authenticated user is not the blog's author
  - `404 Not Found`: Blog not found

---

## 🧪 Postman Testing Guide

1. Open **Postman**.
2. Click **Import** and select the [`postman_collection.json`](./postman_collection.json) file included in this repo.
3. Postman will automatically manage cookies when interacting with `http://localhost:5000`.
4. When you call **Login**, Postman stores the cookie. Subsequent protected requests (**Create Blog**, **Update Blog**, **Delete Blog**) will automatically include it.
5. In the collection, creating a blog automatically sets the collection variable `blogId` for instant testing with Get One, Update, and Delete.

---

## 🎯 Common HTTP Status Codes

- `200 OK`: Request succeeded.
- `201 Created`: User or blog was created.
- `400 Bad Request`: Missing input, invalid format, or malformed ID.
- `401 Unauthorized`: Login required or token is invalid/expired.
- `403 Forbidden`: Authenticated user does not own this resource.
- `404 Not Found`: The requested blog does not exist.
- `409 Conflict`: Email is already registered.
- `500 Internal Server Error`: Unexpected server-side failure.

---

## 💡 Student Practice Tasks

To test your understanding:
1. Register a second user with a different email (e.g. `alice@example.com`).
2. Log in as User A (`rohan@example.com`) and create a blog.
3. Log in as User B (`alice@example.com`) and try to update or delete User A's blog. Verify you receive `403 Forbidden`.
4. Try creating a blog without logging in (or after logging out). Verify you receive `401 Unauthorized`.
5. Try signing up with a password shorter than 6 characters or missing email. Verify you receive `400 Bad Request`.
6. Update only the title, leaving content untouched.
7. Delete the blog, then attempt to fetch it by ID. Verify you receive `404 Not Found`.

