import type { VercelRequest, VercelResponse } from '@vercel/node';
import { predictColleges } from '../lib/predictor';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Add CORS headers for local development if needed
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userRank, category, quota, preferredBranch } = req.body;

    if (!userRank || !category || !quota || !preferredBranch) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const prediction = await predictColleges(
      Number(userRank),
      category,
      quota,
      preferredBranch
    );

    return res.status(200).json(prediction);
  } catch (error) {
    console.error('Error predicting colleges:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
