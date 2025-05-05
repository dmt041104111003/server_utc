import express from 'express';
import { 
    createViolationNFTTransaction, 
    updateViolationNFT, 
    getViolationNFTInfo 
} from '../controllers/violationNFTController.js';

const router = express.Router();

router.post('/create-transaction', createViolationNFTTransaction);

router.post('/update', updateViolationNFT);

router.get('/:violationId', getViolationNFTInfo);

export default router;
