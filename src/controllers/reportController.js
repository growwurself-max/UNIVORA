const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const reportService = require('../services/reportService');

const students = asyncHandler(async (req, res) => {
  const result = await reportService.studentsReport({ accessToken: req.accessToken });
  res.status(200).json(new ApiResponse(200, 'Students report retrieved', result));
});

const faculty = asyncHandler(async (req, res) => {
  const result = await reportService.facultyReport({ accessToken: req.accessToken });
  res.status(200).json(new ApiResponse(200, 'Faculty report retrieved', result));
});

const attendance = asyncHandler(async (req, res) => {
  const result = await reportService.attendanceReport({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Attendance report retrieved', result));
});

const examsResults = asyncHandler(async (req, res) => {
  const result = await reportService.examsResultsReport({ accessToken: req.accessToken, query: req.query });
  res.status(200).json(new ApiResponse(200, 'Exams results report retrieved', result));
});

module.exports = { students, faculty, attendance, examsResults };
