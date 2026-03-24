export function proNotFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
}

export function proErrorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Unexpected server error.";

  res.status(statusCode).json({
    success: false,
    message
  });
}
