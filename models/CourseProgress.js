import mongoose from "mongoose";

const courseProgressSchema = new mongoose.Schema({
    userId: {
        type: String,
        ref: "User",
        required: true
    },
    courseId: { type: String, required: true },
    completed: { type: Boolean, default: false, required: false },
    completedAt: { type: Date },
    lectureCompleted: [],
    tests: [{
        testId: { type: String },
        passed: { type: Boolean, default: false },
        score: { type: Number },
        completedAt: { type: Date },
        answers: [{
            questionIndex: Number,
            selectedAnswers: [String],
            isCorrect: Boolean
        }],
        timeSpent: Number
    }],
    courseInfo: {
        title: { type: String },
        educatorId: { type: String },
        educatorName: { type: String }
    },
    studentInfo: {
        name: { type: String },
        userId: { type: String }
    }
}, { minimize: false });

export const CourseProgress = mongoose.model("CourseProgress", courseProgressSchema);