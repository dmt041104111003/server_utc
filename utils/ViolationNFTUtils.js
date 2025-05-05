import { stringToHex, BlockfrostProvider, MeshTxBuilder, ForgeScript, Transaction } from '@meshsdk/core';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import dotenv from 'dotenv';
import CustomInitiator from './CustomInitiator.js';

dotenv.config();

async function createViolationNFT({
    utxos,
    userAddress,
    collateral,
    violationData
}) {
    try {
        if (!userAddress) {
            throw new Error('User address is required');
        }

        const timestamp = Math.floor(Date.now() / 1000).toString(36);
        const shortViolationId = violationData._id.toString().substring(0, 4);
        const assetName = `VIOL_${shortViolationId}_${timestamp}`;
        const assetNameHex = stringToHex(assetName);

        console.log('NFT Violation asset:', {
            name: assetName,
            nameHex: assetNameHex,
            length: assetName.length
        });

        const educatorAddress = violationData.educatorAddress;
        if (!educatorAddress) {
            throw new Error('Educator address is required');
        }

        const forgingScript = await ForgeScript.withOneSignature(educatorAddress);
        
        const policyId = forgingScript;

        const studentWalletAddress = violationData.walletAddress || userAddress;
        const shortUserAddress = studentWalletAddress ? 
            studentWalletAddress.slice(0, 10) + '_' + studentWalletAddress.slice(-10) : '';
        const shortEducatorAddress = violationData.educatorAddress ? 
            violationData.educatorAddress.slice(0, 10) + '_' + violationData.educatorAddress.slice(-10) : '';

        const courseData = violationData.courseData || {};

        const ipfsHash = "bafkreiealuh6skgbomi77dczcpgacemtr3xxbctsjgvhecbqhx636gx7um";
        
        const metadata = {
            name: `Test Violation Record`,
            description: "Academic integrity violation record",
            image: ipfsHash, 
            mediaType: "image/png",
            properties: {
                violationId: violationData._id.toString(),
            },
            violation_id: violationData._id.toString(),
            "721": {
                [policyId]: {
                    [assetName]: {
                        name: `Test Violation Record`,
                        description: "Academic integrity violation record",
                        image: ipfsHash, 
                        mediaType: "image/png",
                        violation_id: violationData._id.toString(),
                        violation_type: violationData.violationType || 'unknown',
                        violation_message: violationData.message || '',
                        course_id: violationData.courseId ? violationData.courseId.toString() : '',
                        test_id: violationData.testId || '',
                        student_id: violationData.studentId ? violationData.studentId.toString() : '',
                        student_address: shortUserAddress,
                        timestamp: violationData.timestamp || new Date().toISOString(),
                        issued_at: new Date().toISOString().split('T')[0],
                        creator_address: shortEducatorAddress,
                        educator_id: violationData.educatorId || '',
                        created_at: courseData.createdAt || new Date().toISOString(),
                    }
                }
            }
        };

        if (!metadata["721"][policyId] || !metadata["721"][policyId][assetName]) {
            console.error('Invalid metadata structure:', metadata);
            throw new Error('Invalid metadata structure');
        }

       

        const tx = new Transaction({ 
            initiator: new CustomInitiator(violationData.educatorAddress, collateral, utxos)
        });

        const asset = {
            assetName: assetNameHex,
            assetQuantity: "1",
            metadata: metadata,
            label: "721",
            recipient: userAddress,
        };


        tx.mintAsset(forgingScript, asset);

        tx.sendLovelace(
            violationData.educatorAddress, 
            "0", 
            {
                changeAddress: violationData.educatorAddress 
            }
        );

        const unsignedTx = await tx.build();
        return {
            unsignedTx,
            policyId
        };

    } catch (error) {
        throw error;
    }
}

export { createViolationNFT };
