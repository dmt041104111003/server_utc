import Violation from "../models/Violation.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import { createViolationNFT } from '../utils/ViolationNFTUtils.js';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import dotenv from 'dotenv';

dotenv.config();

export const createViolationNFTTransaction = async (req, res) => {
    try {
        const { violationId, utxos, userAddress, collateral, educatorAddress, educatorId, violationData } = req.body;

        if (!violationId || !educatorAddress || !utxos || !userAddress || !collateral) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: violationId, educatorAddress, utxos, userAddress, collateral'
            });
        }

        console.log('Creating violation NFT transaction for:', {
            violationId,
            educatorAddress,
            userAddress
        });

        let processedViolationData = violationData;

        if (!processedViolationData) {
            const violation = await Violation.findById(violationId)
                .populate('courseId', 'courseTitle courseDescription');

            if (!violation) {
                return res.status(404).json({
                    success: false,
                    message: 'Violation not found'
                });
            }

            processedViolationData = {
                _id: violation._id,
                violationType: violation.violationType,
                message: violation.message,
                courseId: violation.courseId?._id || '',
                courseTitle: violation.courseId?.courseTitle || 'Unknown Course',
                testId: violation.testId || '',
                studentId: violation.studentId || '',
                timestamp: violation.timestamp || violation.createdAt,
                educatorId: educatorId || violation.educatorId || '',
                educatorAddress: educatorAddress
            };
        }

        processedViolationData.educatorAddress = educatorAddress;

        console.log('Violation data prepared:', processedViolationData);

        const { unsignedTx, policyId } = await createViolationNFT({
            utxos,
            userAddress,
            collateral,
            violationData: processedViolationData
        });

        console.log('Got policy ID:', policyId);

        res.json({
            success: true,
            unsignedTx,
            policyId
        });

    } catch (error) {
        console.error("Lỗi tạo violation NFT:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const updateViolationNFT = async (req, res) => {
    try {
        const { violationId, policyId, transactionHash } = req.body;

        if (!violationId || !policyId || !transactionHash) {
            return res.status(400).json({
                success: false,
                message: 'Violation ID, Policy ID and Transaction Hash are required'
            });
        }

        console.log('Updating violation NFT with:', {
            violationId,
            policyId,
            transactionHash: transactionHash.slice(0, 10) + '...'
        });

        const violation = await Violation.findByIdAndUpdate(
            violationId,
            {
                policyId,
                transactionHash,
                nftMinted: true
            },
            { new: true }
        );

        if (!violation) {
            return res.status(404).json({
                success: false,
                message: 'Violation not found'
            });
        }

        console.log('Violation updated successfully:', violation._id);

        res.json({
            success: true,
            violation
        });

    } catch (error) {
        console.error('Error updating violation NFT:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getViolationNFTInfo = async (req, res) => {
    try {
        const { violationId } = req.params;

        const violation = await Violation.findById(violationId)
            .populate('courseId', 'courseTitle courseDescription')
            .populate('studentId', 'firstName lastName email');

        if (!violation) {
            return res.status(404).json({
                success: false,
                message: 'Violation not found'
            });
        }

        if (!violation.nftMinted || !violation.policyId || !violation.transactionHash) {
            return res.status(400).json({
                success: false,
                message: 'Violation has not been minted as NFT yet'
            });
        }


        res.json({
            success: true,
            violation: {
                _id: violation._id,
                violationType: violation.violationType,
                message: violation.message,
                courseTitle: violation.courseId.courseTitle,
                testId: violation.testId,
                studentName: violation.studentId ? `${violation.studentId.firstName} ${violation.studentId.lastName}` : 'Unknown',
                studentEmail: violation.studentId ? violation.studentId.email : 'Unknown',
                walletAddress: violation.walletAddress,
                timestamp: violation.timestamp,
                policyId: violation.policyId,
                transactionHash: violation.transactionHash
            }
        });

    } catch (error) {
        console.error('Error getting violation NFT info:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
