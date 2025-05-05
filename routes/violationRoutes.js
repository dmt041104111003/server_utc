import express from 'express';
import { 
    reportViolation, 
    getCourseViolations, 
    getStudentViolations, 
    getAllViolations 
} from '../controllers/violationController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

router.post('/report', reportViolation);

router.get('/course/:courseId', isAuthenticated, getCourseViolations);

router.get('/student/:studentId', isAuthenticated, getStudentViolations);

router.get('/all', getAllViolations);

export default router;
