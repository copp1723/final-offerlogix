import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const list = await storage.getHandovers();
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch handovers' });
  }
});

router.patch('/:id/resolve', async (req, res) => {
  try {
    const updated = await storage.resolveHandover(req.params.id);
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: 'Failed to resolve handover' });
  }
});

export default router;

