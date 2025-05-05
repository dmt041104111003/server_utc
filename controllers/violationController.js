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
            walletAddress 
        } = req.body;

        if (!studentId || !courseId || !testId || !violationType || !imageData) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields for violation report' 
            });
        }

        const violation = await Violation.create({
            studentId,
            walletAddress: walletAddress || "",
            courseId,
            testId,
            violationType,
            message,
            imageData,
            timestamp: new Date()
        });
        
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
        const violations = await Violation.find()
            .populate({
                path: 'courseId',
                select: 'courseTitle'
            })
            .sort({ createdAt: -1 });
        
        console.log(`Found ${violations.length} violations`);

        return res.status(200).json({ success: true, violations });
    } catch (error) {
        console.error("Error fetching all violations:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
