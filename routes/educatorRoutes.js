import express from 'express'

import upload from '../configs/multer.js';
import { protectEducator } from '../middlewares/authMiddleware.js'
import {
    addCourse, deleteCourse, educatorDashboardData,
    getEducatorCourses, getEnrolledStudentsData, updateCourse,
    updatetoRoleToEducator,educatorDetails
} from '../controllers/educatorController.js';

const educatorRouter = express.Router()

educatorRouter.get('/details/:id', educatorDetails);


educatorRouter.get('/update-role', updatetoRoleToEducator)
educatorRouter.post('/add-course', upload.single('image'), protectEducator, addCourse)
educatorRouter.get('/courses', protectEducator, getEducatorCourses)
educatorRouter.get('/dashboard', protectEducator, educatorDashboardData)
educatorRouter.get('/enrolled-students', protectEducator, getEnrolledStudentsData)
educatorRouter.put("/update-course", upload.single("image"), protectEducator, updateCourse);
educatorRouter.delete('/delete-course/:courseId', protectEducator, deleteCourse);
export default educatorRouter;
