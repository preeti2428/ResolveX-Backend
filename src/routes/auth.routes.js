import express from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { signToken, authenticateToken } from '../middleware/auth.js';
import { findCRByEmail } from '../utils/cr-directory.js';
import { findFacultyByEmail } from '../utils/faculty-directory.js';

const router = express.Router();
const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(clientId);

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (role && user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Account found, but registered as '${user.role.toUpperCase()}', not '${role.toUpperCase()}'. Please select the correct role tab.`
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the AIML Department Admin.'
      });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      name: user.name,
      year: user.year,
      branch: user.branch,
      section: user.section
    };

    const token = signToken(tokenPayload);

    const safeUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      branch: user.branch || 'AIML',
      year: user.year,
      semester: user.semester,
      section: user.section,
      roll_no: user.roll_no,
      mobile: user.mobile,
      gender: user.gender,
      is_active: user.is_active,
    };

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error('Auth login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', detail: error.message });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Google Token is required' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    let payload;

    if (clientId) {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } else {
      // Decode payload if client ID isn't configured in dev
      const parts = token.split('.');
      if (parts.length === 3) {
        payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      } else {
        return res.status(400).json({ success: false, message: 'Invalid token format.' });
      }
    }

    const email = payload.email.toLowerCase().trim();
    const crInfo = findCRByEmail(email);
    const facultyInfo = findFacultyByEmail(email);

    if (!crInfo && !facultyInfo) {
      return res.status(403).json({
        success: false,
        message: `Unauthorized. ${email} is not in the official AIML Department CR or Faculty list.`
      });
    }

    const officialInfo = crInfo || facultyInfo;
    const assignedRole = crInfo ? 'cr' : 'teacher';

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: officialInfo.name,
        email: officialInfo.email.toLowerCase(),
        password_hash: bcrypt.hashSync(Math.random().toString(36).slice(-8), 10),
        role: assignedRole,
        department: officialInfo.department || 'AIML',
        branch: officialInfo.branch || (crInfo ? 'AIML' : officialInfo.department || 'AIML'),
        year: officialInfo.year || null,
        semester: officialInfo.semester || null,
        section: officialInfo.section || null,
        roll_no: officialInfo.roll_no || null,
        mobile: officialInfo.mobile || null,
        gender: officialInfo.gender || null,
        is_active: true,
      });
    } else {
      user.name = officialInfo.name;
      user.role = assignedRole;
      user.department = officialInfo.department || 'AIML';
      user.branch = officialInfo.branch || (crInfo ? 'AIML' : officialInfo.department || 'AIML');
      user.year = officialInfo.year || null;
      user.semester = officialInfo.semester || null;
      user.section = officialInfo.section || null;
      user.roll_no = officialInfo.roll_no || null;
      user.mobile = officialInfo.mobile || null;
      user.gender = officialInfo.gender || null;
      user.is_active = true;
      await user.save();
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
    }

    const tokenPayload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      name: user.name,
      year: user.year,
      branch: user.branch,
      section: user.section
    };

    const jwtToken = signToken(tokenPayload);

    const safeUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      branch: user.branch || 'AIML',
      year: user.year,
      semester: user.semester,
      section: user.section,
      roll_no: user.roll_no,
      mobile: user.mobile,
      gender: user.gender,
      is_active: user.is_active,
    };

    return res.json({
      success: true,
      message: 'Google Login successful',
      token: jwtToken,
      user: safeUser,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error or invalid token.', detail: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password_hash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        branch: user.branch || 'AIML',
        year: user.year,
        semester: user.semester,
        section: user.section,
        roll_no: user.roll_no,
        mobile: user.mobile,
        gender: user.gender,
        is_active: user.is_active,
      }
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', detail: error.message });
  }
});

export default router;
