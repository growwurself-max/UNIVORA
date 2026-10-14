const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const resultService = require('../services/resultService');

// GET /results - class-wise or student-wise results based on filters.
const results = asyncHandler(async (req, res) => {
  const result = await resultService.results({
    accessToken: req.accessToken,
    query: req.query,
  });
  res.status(200).json(new ApiResponse(200, 'Results retrieved', result));
});

// GET /results/report-card/:studentId - detailed report card for one student.
const reportCard = asyncHandler(async (req, res) => {
  const result = await resultService.studentResults({
    accessToken: req.accessToken,
    studentId: req.params.studentId,
    query: req.query,
  });
  res.status(200).json(new ApiResponse(200, 'Report card retrieved', result));
});

module.exports = { results, reportCard };
