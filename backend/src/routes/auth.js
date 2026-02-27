const express = require("express");
const { login, getUserById } = require("../services/authService");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const result = await login(username, password);

    res.status(200).json({
      token: result.token,
      user: result.user
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    if (!user.isActive) {
      const error = new Error("Account is deactivated");
      error.statusCode = 403;
      throw error;
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
