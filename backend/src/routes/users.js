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

// All user routes require at least admin, warehouse_manager, or supervisor
router.use(requireRole("admin", "warehouse_manager", "supervisor"));

// List & read — admin, warehouse_manager, supervisor
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

// Create — admin only
router.post("/", requireRole("admin"), async (req, res, next) => {
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

// Update (enable/disable, display name, role, operatorId) — admin, warehouse_manager, supervisor
// Non-admin callers may only toggle isActive
router.patch("/:userId", async (req, res, next) => {
  try {
    const callerRole = req.user.role;
    const { displayName, role, operatorId, isActive } = req.body;

    // Non-admin users can only toggle isActive
    if (callerRole !== "admin") {
      const hasDisallowedFields = displayName !== undefined || role !== undefined || operatorId !== undefined;
      if (hasDisallowedFields) {
        const error = new Error("Only admins can modify user details. You may only enable or disable users.");
        error.statusCode = 403;
        return next(error);
      }
    }

    const user = await updateUser(req.params.userId, {
      displayName,
      role,
      operatorId,
      isActive
    });
    broadcastUserListUpdated();
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

// Reset password — admin only
router.post("/:userId/reset-password", requireRole("admin"), async (req, res, next) => {
  try {
    const user = await resetUserPassword(req.params.userId, req.body.password);
    broadcastUserListUpdated();
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

// Delete — admin only
router.delete("/:userId", requireRole("admin"), async (req, res, next) => {
  try {
    await deleteUser(req.params.userId);
    broadcastUserListUpdated();
    res.status(200).json({ message: "User deleted" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
