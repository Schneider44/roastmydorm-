// pages/api/health/db.js
import { dbConnect } from '../../../frontend/lib/db';

export default async function handler(req, res) {
  try {
    await dbConnect();
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
}
