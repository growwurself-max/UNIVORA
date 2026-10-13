const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const env = require('../config/env');

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// PostgreSQL / PostgREST error codes surfaced by Supabase.
const PG_ERROR_MAP = {
  '23505': { statusCode: 409, message: 'A record with these details already exists' },
  '23503': { statusCode: 409, message: 'Related record not found or still referenced' },
  '23502': { statusCode: 422, message: 'A required field is missing' },
  '23514': { statusCode: 422, message: 'A value failed a database validation check' },
  '23P01': { statusCode: 409, message: 'Scheduling conflict' },
  '22P02': { statusCode: 400, message: 'Invalid input syntax' },
  '22001': { statusCode: 422, message: 'A value is too long' },
  '42501': { statusCode: 403, message: 'You do not have permission to perform this action' },
  '42P01': { statusCode: 503, message: 'Database schema is not initialized' },
  PGRST116: { statusCode: 404, message: 'Resource not found' },
  PGRST205: { statusCode: 503, message: 'Database schema is not initialized' },
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || [];

  let handled = err.isOperational;

  // Errors raised explicitly by our database guards (RAISE EXCEPTION -> P0001).
  if (!handled && err.code === 'P0001') {
    statusCode = 403;
    handled = true;
  }

  if (!handled && err.code && PG_ERROR_MAP[err.code]) {
    const mapped = PG_ERROR_MAP[err.code];
    statusCode = mapped.statusCode;
    message = mapped.message;
    errors = err.details ? [{ message: err.details }] : [];
    handled = true;
  }

  if (!handled && env.isProduction) {
    message = 'Internal server error';
    errors = [];
  }

  if (!env.isProduction) {
    console.error(err);
  }

  res
    .status(statusCode)
    .json(new ApiResponse(statusCode, message, errors.length ? { errors } : null));
};

module.exports = { notFound, errorHandler };
