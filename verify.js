const assert = require("assert");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const User = require("./models/User");
const Blog = require("./models/Blog");
const { signup, login, logout } = require("./controllers/authController");
const {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
} = require("./controllers/blogController");
const authMiddleware = require("./middleware/authMiddleware");

// Helper to create mock req and res
function mockRes() {
  const res = {
    statusCode: 200,
    data: null,
    cookies: {},
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    },
    cookie(name, val, options) {
      this.cookies[name] = { val, options };
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log("==========================================");
  console.log("   BLOG REST API VERIFICATION SUITE       ");
  console.log("==========================================\n");

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  // --- 1. SIGNUP TESTS ---
  console.log("Testing Auth Controller - Signup:");

  await asyncTest("Signup fails with 400 when fields are missing", async () => {
    const req = { body: { name: "Rohan" } };
    const res = mockRes();
    await signup(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.message, "Name, email and password are required");
  });

  await asyncTest("Signup fails with 400 when password < 6 characters", async () => {
    const req = { body: { name: "Rohan", email: "rohan@example.com", password: "123" } };
    const res = mockRes();
    await signup(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.message, "Password must be at least 6 characters");
  });

  await asyncTest("Signup succeeds with 201 and hashes password", async () => {
    let createdUser = null;
    User.findOne = async () => null;
    User.create = async (doc) => {
      createdUser = { ...doc, _id: "user123_id" };
      return createdUser;
    };

    const req = { body: { name: "Rohan", email: "  ROHAN@example.com ", password: "password123" } };
    const res = mockRes();
    await signup(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.message, "User registered successfully");
    assert.strictEqual(res.data.user.email, "rohan@example.com");
    assert.strictEqual(res.data.user.id, "user123_id");
    assert.strictEqual(res.data.user.password, undefined); // Password not exposed
    assert(await bcrypt.compare("password123", createdUser.password));
  });

  await asyncTest("Signup fails with 409 when email already exists", async () => {
    User.findOne = async () => ({ email: "rohan@example.com" });
    const req = { body: { name: "Rohan", email: "rohan@example.com", password: "password123" } };
    const res = mockRes();
    await signup(req, res);

    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.data.message, "Email already registered");
  });

  // --- 2. LOGIN TESTS ---
  console.log("\nTesting Auth Controller - Login & Logout:");

  await asyncTest("Login fails with 400 if email or password missing", async () => {
    const req = { body: { email: "rohan@example.com" } };
    const res = mockRes();
    await login(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await asyncTest("Login fails with 401 if user does not exist", async () => {
    User.findOne = async () => null;
    const req = { body: { email: "nobody@example.com", password: "password123" } };
    const res = mockRes();
    await login(req, res);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.message, "Invalid email or password");
  });

  await asyncTest("Login fails with 401 if password incorrect", async () => {
    const hashed = await bcrypt.hash("correctpassword", 10);
    User.findOne = async () => ({ _id: "user123_id", email: "rohan@example.com", password: hashed });
    const req = { body: { email: "rohan@example.com", password: "wrongpassword" } };
    const res = mockRes();
    await login(req, res);
    assert.strictEqual(res.statusCode, 401);
  });

  let savedCookieToken = null;
  await asyncTest("Login succeeds with 200, sets HTTP-only cookie, returns user", async () => {
    const hashed = await bcrypt.hash("correctpassword", 10);
    User.findOne = async () => ({
      _id: "user123_id",
      name: "Rohan",
      email: "rohan@example.com",
      password: hashed,
    });
    const req = { body: { email: "rohan@example.com", password: "correctpassword" } };
    const res = mockRes();
    await login(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.message, "Login successful");
    assert.strictEqual(res.data.user.email, "rohan@example.com");
    assert(res.cookies.token, "Cookie 'token' must be set");
    assert.strictEqual(res.cookies.token.options.httpOnly, true);
    savedCookieToken = res.cookies.token.val;

    // Verify token can be decoded
    const decoded = jwt.verify(savedCookieToken, process.env.JWT_SECRET);
    assert.strictEqual(decoded.userId, "user123_id");
  });

  test("Logout clears token cookie with 200", () => {
    const req = {};
    const res = mockRes();
    logout(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.message, "Logout successful");
    assert.strictEqual(res.clearedCookies[0].name, "token");
    assert.strictEqual(res.clearedCookies[0].options.httpOnly, true);
  });

  // --- 3. AUTH MIDDLEWARE TESTS ---
  console.log("\nTesting Auth Middleware:");

  test("Middleware rejects request with 401 if token cookie is missing", () => {
    const req = { cookies: {} };
    const res = mockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.message, "Please login first");
    assert.strictEqual(nextCalled, false);
  });

  test("Middleware rejects request with 401 if token is invalid", () => {
    const req = { cookies: { token: "invalid.jwt.token" } };
    const res = mockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.message, "Invalid or expired token");
    assert.strictEqual(nextCalled, false);
  });

  test("Middleware attaches userId and calls next() with valid token", () => {
    const req = { cookies: { token: savedCookieToken } };
    const res = mockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.userId, "user123_id");
  });

  // --- 4. BLOG CONTROLLER TESTS ---
  console.log("\nTesting Blog Controller (CRUD & Ownership):");

  await asyncTest("Create blog fails with 400 when title or content missing/empty", async () => {
    const req = { body: { title: "   ", content: "" }, userId: "user123_id" };
    const res = mockRes();
    await createBlog(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.message, "Title and content are required");
  });

  let createdBlogId = "blog_999";
  await asyncTest("Create blog succeeds with 201 and attaches req.userId as author", async () => {
    Blog.create = async (doc) => ({
      _id: createdBlogId,
      ...doc,
    });
    const req = {
      body: { title: " My First Blog ", content: " Learning Express " },
      userId: "user123_id",
    };
    const res = mockRes();
    await createBlog(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.blog.title, "My First Blog");
    assert.strictEqual(res.data.blog.content, "Learning Express");
    assert.strictEqual(res.data.blog.author, "user123_id");
  });

  await asyncTest("Get all blogs returns 200 with count and blogs array", async () => {
    Blog.find = () => ({
      populate: () => ({
        sort: async () => [
          {
            _id: createdBlogId,
            title: "My First Blog",
            author: { name: "Rohan", email: "rohan@example.com" },
          },
        ],
      }),
    });
    const req = {};
    const res = mockRes();
    await getAllBlogs(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.count, 1);
    assert.strictEqual(res.data.blogs[0].title, "My First Blog");
  });

  await asyncTest("Get one blog returns 200 for existing blog", async () => {
    Blog.findById = () => ({
      populate: async () => ({
        _id: createdBlogId,
        title: "My First Blog",
        author: { name: "Rohan", email: "rohan@example.com" },
      }),
    });
    const req = { params: { id: createdBlogId } };
    const res = mockRes();
    await getBlogById(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.blog._id, createdBlogId);
  });

  await asyncTest("Get one blog returns 404 if blog does not exist", async () => {
    Blog.findById = () => ({
      populate: async () => null,
    });
    const req = { params: { id: "nonexistent_id" } };
    const res = mockRes();
    await getBlogById(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.data.message, "Blog not found");
  });

  await asyncTest("Get one blog returns 400 when ID causes CastError", async () => {
    Blog.findById = () => ({
      populate: async () => {
        const err = new Error("Cast failed");
        err.name = "CastError";
        throw err;
      },
    });
    const req = { params: { id: "invalid-id-format" } };
    const res = mockRes();
    await getBlogById(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.message, "Invalid blog ID");
  });

  await asyncTest("Update blog fails with 403 Forbidden if user is not author", async () => {
    Blog.findById = async () => ({
      _id: createdBlogId,
      author: { toString: () => "user123_id" }, // Owned by user123_id
    });
    const req = {
      params: { id: createdBlogId },
      body: { title: "Hacked title" },
      userId: "different_user_456", // Different user
    };
    const res = mockRes();
    await updateBlog(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.data.message, "You can update only your own blogs");
  });

  await asyncTest("Update blog succeeds with 200 when author updates", async () => {
    const mockBlog = {
      _id: createdBlogId,
      title: "Old title",
      content: "Old content",
      author: { toString: () => "user123_id" },
      save: async function () {},
    };
    Blog.findById = async () => mockBlog;

    const req = {
      params: { id: createdBlogId },
      body: { title: "Updated Blog", content: "I finished the project." },
      userId: "user123_id",
    };
    const res = mockRes();
    await updateBlog(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.message, "Blog updated successfully");
    assert.strictEqual(mockBlog.title, "Updated Blog");
    assert.strictEqual(mockBlog.content, "I finished the project.");
  });

  await asyncTest("Delete blog fails with 403 Forbidden if user is not author", async () => {
    Blog.findById = async () => ({
      _id: createdBlogId,
      author: { toString: () => "user123_id" },
    });
    const req = {
      params: { id: createdBlogId },
      userId: "different_user_456",
    };
    const res = mockRes();
    await deleteBlog(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.data.message, "You can delete only your own blogs");
  });

  await asyncTest("Delete blog succeeds with 200 when author deletes", async () => {
    let deleted = false;
    Blog.findById = async () => ({
      _id: createdBlogId,
      author: { toString: () => "user123_id" },
      deleteOne: async () => { deleted = true; },
    });
    const req = {
      params: { id: createdBlogId },
      userId: "user123_id",
    };
    const res = mockRes();
    await deleteBlog(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.message, "Blog deleted successfully");
    assert.strictEqual(deleted, true);
  });

  console.log("\n==========================================");
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED (100%)`);
  console.log("==========================================");
}

runTests();

