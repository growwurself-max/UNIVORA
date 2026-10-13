const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((validation) => validation.run(req)));

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return next(new ApiError(422, 'Validation failed', formattedErrors));
  }

  return next();
};

module.exports = validate;
