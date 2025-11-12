const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Ensure we haven't sent headers yet
  if (res.headersSent) {
    return next(err);
  }

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  }

  // MySQL/Database errors
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Duplicate entry - record already exists';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Referenced record does not exist';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    statusCode = 503;
    message = 'Database connection error. Please try again later.';
  } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    statusCode = 503;
    message = 'Database authentication error';
  } else if (err.code && err.code.startsWith('ER_')) {
    statusCode = 500;
    message = 'Database error occurred';
  }

  // Multer errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds limit';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    }
  }

  // Ensure Content-Type is set to JSON
  res.setHeader('Content-Type', 'application/json');

  // Send error response as JSON
  try {
    res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        error: err.toString()
      })
    });
  } catch (jsonError) {
    // Fallback if JSON response fails
    console.error('Failed to send JSON error response:', jsonError);
    res.status(500).send(JSON.stringify({
      success: false,
      message: 'Internal server error'
    }));
  }
};

module.exports = errorHandler;
