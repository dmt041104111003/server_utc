import Violation from "../models/Violation.js";
import mongoose from "mongoose";

export const reportViolation = async (req, res) => {
    try {
        const { 
            studentId, 
            courseId, 
            testId, 
            violationType, 
            message,
            imageData,
            walletAddress,
            educatorId 
        } = req.body;

        if (!studentId || !courseId || !testId || !violationType || !imageData) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields for violation report' 
            });
        }

        // Nếu không có educatorId, tìm giáo viên từ khóa học
        let courseEducatorId = educatorId;
        
        if (!courseEducatorId) {
            try {
                const Course = mongoose.model('Course');
                const course = await Course.findById(courseId);
                if (course && course.educator) {
                    courseEducatorId = course.educator;
                    console.log(`Found educator ${courseEducatorId} for course ${courseId}`);
                }
            } catch (error) {
                console.error(`Error finding educator for course ${courseId}:`, error);
            }
        }

        // Kiểm tra xem đã có vi phạm nào của sinh viên này trong khóa học này chưa
        const existingViolation = await Violation.findOne({
            studentId,
            courseId,
            testId
        });
        
        let violation;
        
        if (existingViolation) {
            // Kiểm tra xem vi phạm đã được mint thành NFT chưa
            if (existingViolation.nftMinted) {
                console.log(`Violation for student ${studentId} in course ${courseId} has already been minted as NFT, creating new violation`);
                
                // Tạo vi phạm mới với testId khác đi một chút
                const newTestId = testId + "_" + Date.now().toString().slice(-4);
                console.log(`Creating new violation with modified testId: ${newTestId}`);
                
                violation = await Violation.create({
                    studentId,
                    walletAddress: walletAddress || "",
                    courseId,
                    educatorId: courseEducatorId || "",
                    testId: newTestId,  // Sử dụng testId mới
                    violationType,
                    message,
                    imageData,
                    timestamp: new Date()
                });
                
                console.log(`Created new violation with ID: ${violation._id} for minted test`);
                
                return res.status(201).json({ 
                    success: true, 
                    violation: {
                        _id: violation._id,
                        violationType: violation.violationType,
                        timestamp: violation.timestamp
                    }
                });
            }
            
            // Nếu đã có vi phạm và chưa mint, cập nhật vi phạm đó
            console.log(`Updating existing violation for student ${studentId} in course ${courseId}`);
            
            existingViolation.violationType = violationType;
            existingViolation.message = message;
            existingViolation.imageData = imageData;
            existingViolation.timestamp = new Date();
            
            // Chỉ cập nhật educatorId nếu chưa có
            if (!existingViolation.educatorId && courseEducatorId) {
                existingViolation.educatorId = courseEducatorId;
            }
            
            // Chỉ cập nhật walletAddress nếu chưa có
            if (!existingViolation.walletAddress && walletAddress) {
                existingViolation.walletAddress = walletAddress;
            }
            
            violation = await existingViolation.save();
        } else {
            // Nếu chưa có vi phạm, tạo mới
            console.log(`Creating new violation for student ${studentId} in course ${courseId}`);
            
            violation = await Violation.create({
                studentId,
                walletAddress: walletAddress || "",
                courseId,
                educatorId: courseEducatorId || "",
                testId,
                violationType,
                message,
                imageData,
                timestamp: new Date()
            });
        }
        
        console.log(`Violation created with ID: ${violation._id}, wallet: ${walletAddress || 'not provided'}`);

        return res.status(201).json({ 
            success: true, 
            violation: {
                _id: violation._id,
                violationType: violation.violationType,
                timestamp: violation.timestamp
            }
        });
    } catch (error) {
        console.error("Error reporting violation:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const getCourseViolations = async (req, res) => {
    try {
        const { courseId } = req.params;
        
        if (!courseId) {
            return res.status(400).json({ success: false, message: 'Course ID is required' });
        }

        const violations = await Violation.find({ courseId })
            .sort({ createdAt: -1 });
        
        console.log(`Found ${violations.length} violations for course ${courseId}`);

        return res.status(200).json({ success: true, violations });
    } catch (error) {
        console.error("Error fetching course violations:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const getStudentViolations = async (req, res) => {
    try {
        const { studentId } = req.params;
        
        if (!studentId) {
            return res.status(400).json({ success: false, message: 'Student ID is required' });
        }

        const violations = await Violation.find({ studentId })
            .populate({
                path: 'courseId',
                select: 'courseTitle'
            })
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, violations });
    } catch (error) {
        console.error("Error fetching student violations:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const getAllViolations = async (req, res) => {
    try {
        const { educatorId } = req.query;
        
        // Nếu có educatorId trong query, lọc theo educatorId
        let filter = {};
        if (educatorId) {
            filter = { educatorId };
            console.log(`Filtering violations for educator: ${educatorId}`);
        }
        
        const violations = await Violation.find(filter)
            .populate({
                path: 'courseId',
                select: 'courseTitle educatorId courseDescription creatorAddress createdAt modules students'
            })
            .populate({
                path: 'studentId',
                select: 'name firstName email walletAddress'
            })
            .sort({ createdAt: -1 });
        
        console.log(`Found ${violations.length} violations for filter:`, filter);

        return res.status(200).json({ success: true, violations });
    } catch (error) {
        console.error("Error fetching all violations:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
