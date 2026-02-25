const errorHandler = (error, _req, res, _next) => {
  const statusCode =
    Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;

  if (statusCode >= 500) {
    console.error("Unhandled API error:", error);
  }

  const responsePayload = {
    error: error?.message || "Internal server error"
  };

  if (error?.details !== undefined) {
    responsePayload.details = error.details;
  }

  res.status(statusCode).json(responsePayload);
};

module.exports = errorHandler;
