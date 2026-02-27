const express = require("express");
const requireRole = require("../middlewares/requireRole");
const {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser
} = require("../services/userService");
const { broadcastUserListUpdated } = require("../realtime/socketServer");

const router = express.Router();

router.use(requireRole("admin", "warehouse_manager"));

router.get("/", async (req, res, next) => {
  try {
    const result = await listUsers({
      page: req.query.page,
      limit: req.query.limit
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:userId", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const user = await createUser({
      username: req.body.username,
      password: req.body.password,
      displayName: req.body.displayName,
      role: req.body.role,
      operatorId: req.body.operatorId ?? null
    });
    broadcastUserListUpdated();
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

router.patch("/:userId", async (req, res, next) => {
  try {
    const user = await updateUser(req.params.userId, {
      displayName: req.body.displayName,
      role: req.body.role,
      operatorId: req.body.operatorId,
      isActive: req.body.isActive
    });
    broadcastUserListUpdated();
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

router.post("/:userId/reset-password", async (req, res, next) => {
  try {
    const user = await resetUserPassword(req.params.userId, req.body.password);
    broadcastUserListUpdated();
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

router.delete("/:userId", async (req, res, next) => {
  try {
    await deleteUser(req.params.userId);
    broadcastUserListUpdated();
    res.status(200).json({ message: "User deleted" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
