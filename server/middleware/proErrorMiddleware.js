export function proNotFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
    requestId: String(req.requestId || "")
  });
}

export function proErrorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || 500;
  const isProd = String(process.env.NODE_ENV || "development").toLowerCase() === "production";
  const safeMessage =
    statusCode >= 500 && isProd
      ? "Internal server error."
      : error.message || "Unexpected server error.";
  const requestId = String(req?.requestId || "");

  if (statusCode >= 500) {
    const prefix = requestId ? `[request:${requestId}]` : "[request:unknown]";
    console.error(`${prefix} ${error?.stack || error?.message || "Unhandled error"}`);
  }

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    requestId
  });
}
