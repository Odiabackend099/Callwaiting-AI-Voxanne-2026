import { Router } from 'express';
import { log } from '../services/logger';

const router = Router();

// Test endpoint to trigger uncaught exception
router.get('/', (req, res) => {
  log.info('TestError', 'Triggering uncaught exception for testing');
  
  // Simulate an uncaught exception
  setTimeout(() => {
    throw new Error('Test uncaught exception for monitoring verification');
  }, 100);
  
  res.json({ message: 'Exception will be triggered in 100ms' });
});

export default router;
