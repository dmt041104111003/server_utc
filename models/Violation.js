import mongoose from "mongoose";

const violationSchema = new mongoose.Schema({
    studentId: { 
        type: String, 
        required: true
    },
    walletAddress: {
        type: String,
        default: ""
    },
    courseId: { 
        type: String, 
        required: true 
    },
    educatorId: {
        type: String,
        default: ""
    },
    testId: { 
        type: String, 
        required: true 
    },
    violationType: {
        type: String,
        enum: [
            'face_not_detected',
            'looking_away',
            'phone_detected',
            'fullscreen_exit',
            'tab_switch',
            'other'
        ],
        required: true
    },
    message: { 
        type: String, 
        required: true 
    },
    imageData: {
        type: String,  
        required: true
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    nftMinted: {
        type: Boolean,
        default: false
    },
    policyId: {
        type: String,
        default: ""
    },
    transactionHash: {
        type: String,
        default: ""
    }
}, { timestamps: true });

const Violation = mongoose.model('Violation', violationSchema);
export default Violation;
