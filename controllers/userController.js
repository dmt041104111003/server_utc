import User from "../models/User.js"
import { Purchase } from "../models/Purchase.js";
import Stripe from "stripe"
import Course from "../models/Course.js"
import { CourseProgress } from "../models/CourseProgress.js";
import mongoose from "mongoose";
import moment from "moment"

export const getUserData = async (req, res) => {
    try {
        const userId = req.auth.userId
        const user = await User.findById(userId)

        if (!user) {
            return res.json({ success: false, message: 'User not Found' })
        }

        // Calculate premium and cooldown logic
        let isPremium = false;
        let premiumExpiry = null;
        let canCreateCourse = true;
        let cooldownMs = 0;
        const now = new Date();
        if (user.premiumExpiry && user.premiumExpiry > now) {
            isPremium = true;
            premiumExpiry = user.premiumExpiry;
            canCreateCourse = true;
            cooldownMs = 0;
        } else {
            isPremium = false;
            premiumExpiry = user.premiumExpiry;
            if (user.lastCourseCreatedAt) {
                const diff = 10 * 60 * 1000 - (now - user.lastCourseCreatedAt);
                if (diff > 0) {
                    canCreateCourse = false;
                    cooldownMs = diff;
                } else {
                    canCreateCourse = true;
                    cooldownMs = 0;
                }
            } else {
                canCreateCourse = true;
                cooldownMs = 0;
            }
        }

        res.json({ 
            success: true, 
            user: {
                ...user.toObject(),
                isPremium,
                premiumExpiry,
                canCreateCourse,
                cooldownMs
            }
        })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

export const userEnrolledCourses = async (req, res) => {
    try {
        const userId = req.auth.userId
        const userData = await User.findById(userId).populate('enrolledCourses')
        res.json({ success: true, enrolledCourses: userData.enrolledCourses })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}


export const purchaseCourse = async (req, res) => {
    try {
        const { courseId } = req.body
        const { origin } = req.headers
        const userId = req.auth.userId
        const userData = await User.findById(userId)
        const courseData = await Course.findById(courseId)

        if (!userData || !courseData) {
            return res.json({ success: false, message: 'Data Not Found' })
        }

        const purchaseData = {
            courseId: courseData._id,
            userId,
            amount: courseData.coursePrice - (courseData.discount * courseData.coursePrice / 100)
        }

        // Nếu giá = 0, tự động enroll
        if (purchaseData.amount === 0) {
            await User.findByIdAndUpdate(
                userId,
                { $addToSet: { enrolledCourses: courseId } }
            );
            
            await Purchase.create({
                ...purchaseData,
                status: 'completed'
            });

            return res.json({ 
                success: true,
                message: 'Enrolled successfully',
                redirect_url: `${origin}/loading/my-enrollments`
            });
        }

        const newPurchase = await Purchase.create(purchaseData)

        const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)
        const currency = process.env.CURRENCY.toLowerCase()

        const line_items = [{
            price_data: {
                currency,
                product_data: {
                    name: courseData.courseTitle
                },
                unit_amount: Math.round(newPurchase.amount * 100) 
            },
            quantity: 1
        }]

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-enrollments`,
            cancel_url: `${origin}/`,
            line_items: line_items,
            mode: 'payment',
            metadata: {
                purchaseId: newPurchase._id.toString()
            }
        })
        res.json({ success: true, session_url: session.url })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}



export const getAllCompletedCourses = async (req, res) => {
    try {
        const allProgress = await CourseProgress.find()
            .populate("userId", "name")
            .populate({
                path: "courseId",
                select: "courseTitle courseContent",
                model: Course
            });

        if (!allProgress.length) {
            return res.json({ success: true, completedCourses: [], message: "No progress records found" });
        }

        const completedCourses = await Promise.all(
            allProgress.map(async (progress) => {
                if (!progress.userId || !progress.courseId) {
                    console.log("Invalid progress entry (missing userId or courseId):", progress);
                    return null;
                }

                const course = progress.courseId;

                if (!course || typeof course !== "object") {
                    console.log(`Course not populated for courseId: ${progress.courseId}`);
                    return null;
                }

                console.log("Populated userId:", JSON.stringify(progress.userId, null, 2));
                console.log("Populated course:", JSON.stringify(course, null, 2));

                if (!course.courseContent || !Array.isArray(course.courseContent)) {
                    console.log(`Course ${course.courseTitle || progress.courseId} has no valid courseContent`);
                    return null;
                }

                const totalLectures = course.courseContent.reduce(
                    (total, chapter) => total + (chapter.chapterContent ? chapter.chapterContent.length : 0),
                    0
                );

                if (totalLectures === 0) {
                    console.log(`Course ${course.courseTitle} has no lectures`);
                    return null;
                }

                const completedLectures = progress.lectureCompleted ? progress.lectureCompleted.length : 0;
                const isCompleted = totalLectures > 0 && completedLectures === totalLectures;

                if (isCompleted) {
                    return {
                        courseId: course._id,
                        courseTitle: course.courseTitle || "Unnamed Course",
                        userId: progress.userId._id,
                        name: progress.userId.name || "User",
                        completionDate: progress.updatedAt || new Date(),
                    };
                }
                return null;
            })
        );

        const filteredCompletedCourses = completedCourses.filter((course) => course !== null);

        res.json({
            success: true,
            completedCourses: filteredCompletedCourses,
            message: filteredCompletedCourses.length === 0 ? "No completed courses found" : undefined
        });
    } catch (error) {
        console.error("Error in getAllCompletedCourses:", error);
        res.json({ success: false, message: error.message });
    }
};
export const updateUserCourseProgress = async (req, res) => {
    try {
        const userId = req.auth.userId
        const { courseId, lectureId, test } = req.body

        console.log('Received request:', { courseId, lectureId, test });

        // Lấy thông tin khóa học 
        const course = await Course.findById(courseId);
        if (!course) {
            return res.json({ success: false, message: 'Course not found' });
        }

        console.log('Course found:', {
            id: course._id,
            hasContent: !!course.courseContent,
            contentLength: course.courseContent?.length || 0
        });

        // Lấy hoặc tạo mới progress data
        let progressData = await CourseProgress.findOne({ userId, courseId });
        if (!progressData) {
            // Get course, educator and student info
            const [courseWithEducator, student] = await Promise.all([
                Course.findById(courseId).populate('educator'),
                User.findById(userId)
            ]);
            
            progressData = await CourseProgress.create({
                userId,
                courseId,
                lectureCompleted: [],
                tests: [],
                courseInfo: {
                    title: courseWithEducator.courseTitle,
                    educatorId: courseWithEducator.educator?._id || '',
                    educatorName: courseWithEducator.educator?.name || ''
                },
                studentInfo: {
                    name: student?.name || '',
                    userId: student?._id
                }
            });
        }

        // Đếm tổng số lecture và test, và map lecture IDs
        let totalLectures = 0;
        let totalTests = 0;
        let normalLectures = new Map(); // Map lecture id to lecture object
        let testLectures = new Map();   // Map test id to test object

        // Count lectures from courseContent
        if (course.courseContent && Array.isArray(course.courseContent)) {
            console.log('Processing course content...');
            course.courseContent.forEach((chapter, idx) => {
                if (chapter.chapterContent && Array.isArray(chapter.chapterContent)) {
                    chapter.chapterContent.forEach(lecture => {
                        const lectureId = lecture.lectureId?.toString();
                        if (!lectureId) {
                            console.log('Warning: Lecture has no ID:', lecture);
                            return;
                        }
                        totalLectures++;
                        normalLectures.set(lectureId, lecture);
                    });
                }
            });
        }

        // Count tests from tests array
        if (course.tests && Array.isArray(course.tests)) {
            console.log('Processing tests...');
            course.tests.forEach(test => {
                const testId = test.testId?.toString();
                if (!testId) {
                    console.log('Warning: Test has no ID:', test);
                    return;
                }
                totalTests++;
                testLectures.set(testId, test);
            });
        }

        // Debug info
        console.log('Debug info:');
        console.log('Total lectures:', totalLectures);
        console.log('Total tests:', totalTests);
        console.log('Normal lecture IDs:', Array.from(normalLectures.keys()));
        console.log('Test lecture IDs:', Array.from(testLectures.keys()));
        console.log('Completed lectures:', progressData.lectureCompleted);
        console.log('Tests:', progressData.tests);

        // Nếu là test thì cập nhật hoặc thêm mới vào mảng tests
        if (test) {
            const testIndex = progressData.tests.findIndex(t => t.testId === lectureId);
            const newTest = {
                testId: lectureId,
                passed: test.passed,
                score: test.score,
                completedAt: new Date(),
                answers: test.answers || [],
                timeSpent: test.timeSpent || 0
            };
            
            if (testIndex >= 0) {
                // Cập nhật test đã tồn tại
                progressData.tests[testIndex] = newTest;
            } else {
                // Thêm test mới
                progressData.tests.push(newTest);
            }
        }
        // Nếu không phải test và là lecture hợp lệ thì lưu vào lectureCompleted
        else if (normalLectures.has(lectureId)) {
            if (!progressData.lectureCompleted.includes(lectureId)) {
                progressData.lectureCompleted.push(lectureId);
            }
        }

        // Đếm số lecture đã hoàn thành (chỉ tính các lecture thường)
        const completedLectures = progressData.lectureCompleted.filter(id => 
            normalLectures.has(id)
        ).length;

        // Đếm số test đã pass
        const passedTests = progressData.tests.filter(test => test.passed);

        console.log('Completed normal lectures:', completedLectures);
        console.log('Passed tests:', passedTests.length);

        // Chỉ completed = true khi hoàn thành cả lecture và pass hết test
        const isNowCompleted = (totalLectures === 0 || completedLectures >= totalLectures) && 
                              (totalTests === 0 || passedTests.length >= totalTests);

        // If course is being completed for the first time, set completedAt and update educator info
        if (isNowCompleted && !progressData.completed) {
            progressData.completedAt = new Date();
            
                // Get course and educator info
            const courseWithEducator = await Course.findById(courseId).populate('educator');
            if (courseWithEducator) {
                progressData.courseInfo = {
                    title: courseWithEducator.courseTitle,
                    educatorId: courseWithEducator.educator?._id || '',
                    educatorName: courseWithEducator.educator?.name || ''
                };
            }
            
            // Get student info
            const student = await User.findById(userId);
            if (student) {
                progressData.studentInfo = {
                    name: student.name || '',
                    userId: student._id
                };
            }
        }
        
        progressData.completed = isNowCompleted;

        console.log('Course completed:', progressData.completed);

        await progressData.save();
        
        res.json({ 
            success: true, 
            message: 'Progress Updated',
            completed: progressData.completed,
            progress: {
                lectures: `${completedLectures}/${totalLectures}`,
                tests: `${passedTests.length}/${totalTests}`
            }
        });

    } catch (error) {
        console.error('Error updating progress:', error);
        res.json({ success: false, message: error.message });
    }
};

export const getUserCourseProgress = async (req, res) => {
    try {
        const userId = req.auth.userId
        const { courseId } = req.body
        const progressData = await CourseProgress.findOne({ userId, courseId })
        res.json({ success: true, progressData })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

export const addUserRating = async (req, res) => {
    const userId = req.auth.userId;
    const { courseId, rating } = req.body;
    if (!courseId || !userId || !rating || rating < 1 || rating > 5) {
        return res.json({ success: false, message: 'Invalid Details' });
    }

    try {
        const course = await Course.findById(courseId);
        if (!course) {
            return res.json({ success: false, message: 'Course not found' });
        }
        
        const user = await User.findById(userId);
        if (!user || !user.enrolledCourses.includes(courseId)) {
            return res.json({ success: false, message: 'User has not purchased this course.' });
        }

        const existingRatingIndex = course.courseRatings.findIndex(r => r.userId === userId)
        if (existingRatingIndex > -1) {
            course.courseRatings[existingRatingIndex].rating = rating;
        } else {
            course.courseRatings.push({ userId, rating });
        }
        
        await course.save();
        
        // Return the updated course ratings along with success message
        return res.json({ 
            success: true, 
            message: 'Rating saved successfully',
            courseRatings: course.courseRatings,
            userRating: rating
        });
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

export const updateCourseEducator = async (req, res) => {
    try {
        const { courseId, educatorInfo } = req.body;
        const userId = req.auth.userId;

        // Find the course progress
        const progressData = await CourseProgress.findOne({ userId, courseId });

        if (!progressData) {
            return res.json({ success: false, message: 'Course progress not found' });
        }

        // Update educator information
        progressData.educator = {
            ...educatorInfo,
            updatedAt: new Date()
        };

        await progressData.save();

        res.json({ 
            success: true, 
            message: 'Educator information updated successfully',
            educator: progressData.educator
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const getSimpleCertificateData = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { courseId } = req.body;

        // Get course progress with all required info
        const progressData = await CourseProgress.findOne({ 
            userId, 
            courseId,
            completed: true 
        });

        if (!progressData) {
            return res.json({ 
                success: false, 
                message: 'No completed course progress found' 
            });
        }

        res.json({
            success: true,
            progressData: progressData
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const enrollCourses = async (req, res) => {
    const { origin } = req.headers;
    const userId = req.auth.userId;
    let { courseId, paymentMethod, currency, receiverAddress, senderAddress } = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }
    courseId = new mongoose.Types.ObjectId(courseId);

    const user = await User.findById(userId);
    const course = await Course.findById(courseId);

    if (!user || !course) {
        return res.status(404).json({ success: false, message: 'User or course not found' });
    }
  
    try {
        if (!user.enrolledCourses.includes(courseId)) {
            user.enrolledCourses.push(courseId);
            course.enrolledStudents.push(userId); 

            const purchaseData = {
                courseId,
                userId,
                amount: (
                    course.coursePrice - (course.discount * course.coursePrice) / 100
                ).toFixed(2),
                status: "completed",
                currency: currency,
                paymentMethod: paymentMethod,
                receiverAddress: receiverAddress,
                senderAddress: senderAddress, // Lưu địa chỉ ví người gửi
                createdAt: new Date(),
                note: ""
            };
            await Purchase.create(purchaseData);

            await user.save();
            await course.save(); 

            return res.json({ success: true, message: 'Courses enrolled successfully' });
        } else {
            return res.json({ success: false, message: 'You are already enrolled in this course' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Lấy lịch sử mua hàng của user
export const getUserPurchaseHistory = async (req, res) => {
    try {
        const userId = req.auth.userId;
        // Lấy tất cả purchase của user, có thể populate courseId để lấy tên khóa học
        const purchases = await Purchase.find({ userId }).populate('courseId', 'courseTitle');
        res.json({ success: true, purchases });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Reset tiến trình khóa học của user
export const resetCourseProgress = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { courseId } = req.body;

        if (!courseId) {
            return res.status(400).json({ success: false, message: 'Course ID is required' });
        }

        // Tìm tiến trình khóa học
        const progressData = await CourseProgress.findOne({ userId, courseId });

        if (!progressData) {
            return res.status(404).json({ success: false, message: 'Course progress not found' });
        }

        // Reset tiến trình
        progressData.lectureCompleted = [];
        progressData.tests = [];
        progressData.completed = false;
        progressData.completedAt = null;
        progressData.lastUpdated = new Date();

        await progressData.save();

        res.json({ 
            success: true, 
            message: 'Course progress has been reset successfully',
            progressData
        });
    } catch (error) {
        console.error('Error resetting course progress:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
