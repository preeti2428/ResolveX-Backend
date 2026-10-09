import express from 'express';
import { Grievance } from '../models/Grievance.js';
import { Category } from '../models/Category.js';
import { User } from '../models/User.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { createNotification, notifyAdmins } from '../utils/notifications.js';

const router = express.Router();

function validateDetails(categoryName, details) {
  const errors = [];
  if (!details || typeof details !== 'object') {
    return ['Category details object is missing.'];
  }

  if (categoryName === 'Faculty') {
    if (!details.faculty_name || !details.faculty_name.trim()) errors.push('Faculty Name is required.');
    if (!details.course || !details.course.trim()) errors.push('Course/Subject is required.');
    if (!details.section || !details.section.trim()) errors.push('Section is required.');
  } else if (categoryName === 'Classroom') {
    if (!details.room_no || !details.room_no.trim()) errors.push('Room number is required.');
    if (!details.block || !details.block.trim()) {
      details.block = 'H Block';
    }
    if (!details.floor || !details.floor.trim()) {
      const match = details.room_no ? details.room_no.match(/\d+/) : null;
      if (match) {
        const floorMap = {
          '0': 'Ground Floor',
          '1': '1st Floor',
          '2': '2nd Floor',
          '3': '3rd Floor',
          '4': '4th Floor',
          '5': '5th Floor',
          '6': '6th Floor',
          '7': '7th Floor',
          '8': '8th Floor',
        };
        details.floor = floorMap[match[0][0]] || 'Ground Floor';
      } else {
        errors.push('Floor is required.');
      }
    }
    if (!details.issue_type || !details.issue_type.trim()) errors.push('Issue type is required.');
  } else if (categoryName === 'Labs') {
    if (!details.lab_name || !details.lab_name.trim()) errors.push('Lab name is required.');
    if (!details.issue_type || !details.issue_type.trim()) errors.push('Issue type is required.');
  } else if (categoryName === 'Cabin Issue') {
    if (!details.cabin_no || !details.cabin_no.trim()) errors.push('Cabin number is required.');
    if (!details.issue_type || !details.issue_type.trim()) errors.push('Issue type is required.');
  } else if (categoryName === 'Student Issue') {
    if (!details.student_name || !details.student_name.trim()) errors.push('Student name is required.');
    if (!details.roll_no || !details.roll_no.trim()) errors.push('Roll number is required.');
    if (!details.issue_type || !details.issue_type.trim()) errors.push('Issue type is required.');
  }

  return errors;
}

// GET /api/grievances/all (Admin, Infra Head, IT Infra Head, AC Incharge)
router.get('/all', authenticateToken, requireRole(['admin', 'infra_head', 'it_infra_head', 'ac_incharge']), async (req, res) => {
  try {
    const { status, category_id, role, search, year, branch } = req.query;
    const filter = {};

    if (req.user.role === 'infra_head') {
      filter.assigned_department = 'infra';
    } else if (req.user.role === 'it_infra_head') {
      filter.assigned_department = 'it_infra';
    } else if (req.user.role === 'ac_incharge') {
      filter.assigned_department = { $in: ['ac_incharge', 'ac'] };
    }

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (category_id && category_id !== 'all') {
      filter.category_id = category_id;
    }
    if (year && year !== 'all') {
      filter.year = Number(year);
    }
    if (branch && branch !== 'all') {
      filter.branch = branch;
    }
    if (role && role !== 'all') {
      const usersWithRole = await User.find({ role }).select('_id');
      const submitterIds = usersWithRole.map((u) => u._id);
      filter.submitted_by = { $in: submitterIds };
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      const usersMatching = await User.find({
        $or: [{ name: regex }, { email: regex }]
      }).select('_id');
      const matchedUserIds = usersMatching.map(u => u._id);

      filter.$or = [
        { description: regex },
        { submitted_by: { $in: matchedUserIds } }
      ];
    }

    const grievances = await Grievance.find(filter)
      .populate('category_id', 'name allowed_role')
      .populate('submitted_by', 'name email role section department branch year')
      .populate('resolved_by', 'name role')
      .sort({ created_at: -1 });

    const formatted = grievances.map((g) => ({
      id: g._id.toString(),
      _id: g._id.toString(),
      description: g.description,
      details: g.details,
      attachment_url: g.attachment_url,
      resolution_photo_url: g.resolution_photo_url || null,
      assigned_department: g.assigned_department || null,
      status: g.status,
      admin_notes: g.admin_notes,
      year: g.year || g.submitted_by?.year || 1,
      branch: g.branch || g.submitted_by?.branch || 'AIML',
      section: g.section || g.submitted_by?.section || 'A',
      created_at: g.created_at,
      updated_at: g.updated_at,
      resolved_at: g.resolved_at,
      category_name: g.category_id?.name || 'General',
      category: g.category_id ? { id: g.category_id._id, name: g.category_id.name } : null,
      submitted_by_name: g.submitted_by?.name || 'Anonymous',
      submitter_name: g.submitted_by?.name || 'Anonymous',
      submitted_by_email: g.submitted_by?.email || '',
      submitter_email: g.submitted_by?.email || '',
      submitted_by_role: g.submitted_by?.role || 'student',
      submitter_role: g.submitted_by?.role || 'student',
      submitted_by_section: g.submitted_by?.section || null,
      status_logs: g.status_logs || [],
      comments: g.comments || [],
    }));

    return res.json({ success: true, count: formatted.length, grievances: formatted });
  } catch (error) {
    console.error('Fetch all grievances error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch grievances.', detail: error.message });
  }
});

// GET /api/grievances/my (Current user's grievances)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const grievances = await Grievance.find({ submitted_by: req.user.id })
      .populate('category_id', 'name allowed_role')
      .populate('submitted_by', 'name email role section department branch year')
      .populate('resolved_by', 'name role')
      .sort({ created_at: -1 });

    const formatted = grievances.map((g) => ({
      id: g._id.toString(),
      _id: g._id.toString(),
      description: g.description,
      details: g.details,
      attachment_url: g.attachment_url,
      status: g.status,
      admin_notes: g.admin_notes,
      resolution_photo_url: g.resolution_photo_url || null,
      year: g.year || g.submitted_by?.year || 1,
      branch: g.branch || g.submitted_by?.branch || 'AIML',
      section: g.section || g.submitted_by?.section || 'A',
      created_at: g.created_at,
      updated_at: g.updated_at,
      resolved_at: g.resolved_at,
      category_name: g.category_id?.name || 'General',
      category: g.category_id ? { id: g.category_id._id, name: g.category_id.name } : null,
      submitted_by_name: g.submitted_by?.name || 'Anonymous',
      submitter_name: g.submitted_by?.name || 'Anonymous',
      submitted_by_email: g.submitted_by?.email || '',
      submitter_email: g.submitted_by?.email || '',
      submitted_by_role: g.submitted_by?.role || 'student',
      submitter_role: g.submitted_by?.role || 'student',
      status_logs: g.status_logs || [],
      comments: g.comments || [],
    }));

    return res.json({ success: true, count: formatted.length, grievances: formatted });
  } catch (error) {
    console.error('Fetch user grievances error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch your grievances.' });
  }
});

// GET /api/grievances (Default list)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let filter = { submitted_by: req.user.id };
    if (req.user.role === 'admin') {
      filter = {};
    } else if (req.user.role === 'infra_head') {
      filter = { assigned_department: 'infra' };
    } else if (req.user.role === 'it_infra_head') {
      filter = { assigned_department: 'it_infra' };
    } else if (req.user.role === 'ac_incharge') {
      filter = { assigned_department: { $in: ['ac_incharge', 'ac'] } };
    }
    const grievances = await Grievance.find(filter)
      .populate('category_id', 'name allowed_role')
      .populate('submitted_by', 'name email role section department branch year')
      .populate('resolved_by', 'name role')
      .sort({ created_at: -1 });

    const formatted = grievances.map((g) => ({
      id: g._id.toString(),
      _id: g._id.toString(),
      description: g.description,
      details: g.details,
      attachment_url: g.attachment_url,
      status: g.status,
      admin_notes: g.admin_notes,
      resolution_photo_url: g.resolution_photo_url,
      year: g.year || g.submitted_by?.year || 1,
      branch: g.branch || g.submitted_by?.branch || 'AIML',
      section: g.section || g.submitted_by?.section || 'A',
      created_at: g.created_at,
      updated_at: g.updated_at,
      resolved_at: g.resolved_at,
      category_name: g.category_id?.name || 'General',
      category: g.category_id ? { id: g.category_id._id, name: g.category_id.name } : null,
      submitted_by_name: g.submitted_by?.name || 'Anonymous',
      submitter_name: g.submitted_by?.name || 'Anonymous',
      submitted_by_email: g.submitted_by?.email || '',
      submitter_email: g.submitted_by?.email || '',
      submitted_by_role: g.submitted_by?.role || 'student',
      submitter_role: g.submitted_by?.role || 'student',
      status_logs: g.status_logs || [],
      comments: g.comments || [],
    }));

    return res.json({ success: true, count: formatted.length, grievances: formatted });
  } catch (error) {
    console.error('List grievances error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list grievances.' });
  }
});

// POST /api/grievances (Submit grievance)
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'cr' && req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only CR and Teacher roles can submit grievances.' });
    }

    const { category_id, description, details, attachment_url, year, branch, section } = req.body;

    if (!category_id) {
      return res.status(400).json({ success: false, message: 'Category is required.' });
    }

    const category = await Category.findById(category_id);
    if (!category) {
      return res.status(400).json({ success: false, message: 'Selected category does not exist.' });
    }

    if (category.allowed_role !== 'both' && category.allowed_role !== req.user.role) {
      return res.status(403).json({
        success: false,
        message: `The '${category.name}' category is not available for ${req.user.role.toUpperCase()} role.`
      });
    }

    let finalDetails = details || {};
    if (typeof finalDetails === 'string') {
      try {
        finalDetails = JSON.parse(finalDetails);
      } catch (e) {
        finalDetails = {};
      }
    }

    const validationErrors = validateDetails(category.name, finalDetails);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: validationErrors.join(' ') });
    }

    const initialLog = {
      old_status: null,
      new_status: 'pending',
      changed_by: req.user.id,
      changed_by_name: req.user.name,
      changed_by_role: req.user.role,
      note: 'Grievance ticket created.',
      changed_at: new Date(),
    };

    const submitter = await User.findById(req.user.id);

    const newGrievance = await Grievance.create({
      submitted_by: req.user.id,
      category_id: category._id,
      year: year || submitter?.year || 1,
      branch: branch || submitter?.branch || 'AIML',
      section: section || submitter?.section || 'A',
      description: (description && typeof description === 'string') ? description.trim() : '',
      details: finalDetails,
      attachment_url: attachment_url || null,
      status: 'pending',
      status_logs: [initialLog],
      comments: [],
    });

    // Notify Admins
    try {
      await notifyAdmins({
        title: `New Grievance: ${category.name}`,
        message: `${req.user.name} submitted a new grievance regarding ${category.name}.`,
        type: 'grievance_new',
        link_id: newGrievance._id,
      });
    } catch (e) {
      console.warn('Failed to notify admins of new grievance:', e.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Grievance submitted successfully.',
      grievance: {
        id: newGrievance._id.toString(),
        _id: newGrievance._id.toString(),
        status: newGrievance.status,
        created_at: newGrievance.created_at,
      },
    });
  } catch (error) {
    console.error('Submit grievance error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', detail: error.message });
  }
});

// GET /api/grievances/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const grievance = await Grievance.findById(req.params.id)
      .populate('category_id', 'name allowed_role')
      .populate('submitted_by', 'name email role section department branch year')
      .populate('resolved_by', 'name role');

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found.' });
    }

    const isSubmitter = grievance.submitted_by && grievance.submitted_by._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isAssigned = (req.user.role === 'infra_head' && grievance.assigned_department === 'infra') || 
                       (req.user.role === 'it_infra_head' && grievance.assigned_department === 'it_infra') ||
                       (req.user.role === 'ac_incharge' && (grievance.assigned_department === 'ac_incharge' || grievance.assigned_department === 'ac'));

    if (!isSubmitter && !isAdmin && !isAssigned) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.json({
      success: true,
      grievance: {
        id: grievance._id.toString(),
        _id: grievance._id.toString(),
        description: grievance.description,
        details: grievance.details,
        attachment_url: grievance.attachment_url,
        status: grievance.status,
        admin_notes: grievance.admin_notes,
        resolution_photo_url: grievance.resolution_photo_url,
        year: grievance.year,
        branch: grievance.branch,
        section: grievance.section,
        created_at: grievance.created_at,
        updated_at: grievance.updated_at,
        resolved_at: grievance.resolved_at,
        category_name: grievance.category_id?.name || 'General',
        category: grievance.category_id,
        submitted_by_name: grievance.submitted_by?.name || 'Anonymous',
        submitted_by_email: grievance.submitted_by?.email || '',
        submitted_by_role: grievance.submitted_by?.role || 'student',
        status_logs: grievance.status_logs || [],
        comments: grievance.comments || [],
      }
    });
  } catch (error) {
    console.error('Get grievance by id error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch grievance details.' });
  }
});

// PATCH /api/grievances/:id/status (Admin status update)
router.patch('/:id/status', authenticateToken, requireRole(['admin', 'infra_head', 'it_infra_head', 'ac_incharge']), async (req, res) => {
  try {
    const { status, admin_notes, resolution_photo_url } = req.body;
    const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be: ${validStatuses.join(', ')}` });
    }

    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found.' });
    }

    const oldStatus = grievance.status;
    const isResolvedOrRejected = status === 'resolved' || status === 'rejected';

    grievance.status = status;
    if (admin_notes !== undefined) {
      grievance.admin_notes = admin_notes;
    }

    if (resolution_photo_url !== undefined) {
      grievance.resolution_photo_url = resolution_photo_url;
    }

    if (isResolvedOrRejected) {
      grievance.resolved_by = req.user.id;
      grievance.resolved_at = new Date();
    } else if (status === 'pending') {
      grievance.resolved_by = null;
      grievance.resolved_at = null;
    }

    const logNote = admin_notes
      ? `Status changed to ${status.replace('_', ' ').toUpperCase()}. Note: ${admin_notes}`
      : `Status changed to ${status.replace('_', ' ').toUpperCase()}`;

    grievance.status_logs.push({
      old_status: oldStatus,
      new_status: status,
      changed_by: req.user.id,
      changed_by_name: req.user.name,
      changed_by_role: req.user.role,
      note: logNote,
      changed_at: new Date(),
    });

    await grievance.save();

    // Notify submitter
    try {
      await createNotification({
        recipient: grievance.submitted_by,
        title: `Grievance Status Updated`,
        message: `Your grievance status was changed from "${oldStatus}" to "${status.replace('_', ' ')}".`,
        type: 'grievance_status',
        link_id: grievance._id,
      });
    } catch (e) {
      console.warn('Failed to notify submitter:', e.message);
    }

    return res.json({
      success: true,
      message: `Status updated to ${status}.`,
      grievance: {
        id: grievance._id.toString(),
        _id: grievance._id.toString(),
        status: grievance.status,
        admin_notes: grievance.admin_notes,
        resolution_photo_url: grievance.resolution_photo_url,
        resolved_at: grievance.resolved_at,
        status_logs: grievance.status_logs,
      }
    });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update status.', detail: error.message });
  }
});

// PATCH /api/grievances/:id/assign (Admin assigns to infra / IT / AC)
router.patch('/:id/assign', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { assigned_department } = req.body;
    const validDepts = ['infra', 'it_infra', 'ac_incharge', 'ac', null];
    if (!validDepts.includes(assigned_department)) {
      return res.status(400).json({ success: false, message: 'Invalid department.' });
    }

    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found.' });
    }

    grievance.assigned_department = assigned_department;
    const deptDisplayNames = {
      infra: 'Infra Incharge',
      it_infra: 'IT Infra Incharge',
      ac_incharge: 'AC Incharge',
      ac: 'AC Incharge',
    };
    grievance.status_logs.push({
      old_status: grievance.status,
      new_status: grievance.status,
      changed_by: req.user.id,
      changed_by_name: req.user.name,
      changed_by_role: req.user.role,
      note: `Grievance forwarded to ${assigned_department ? (deptDisplayNames[assigned_department] || assigned_department.toUpperCase()) : 'General Admin'}`,
      changed_at: new Date(),
    });

    await grievance.save();
    return res.json({ success: true, message: 'Grievance assigned.', grievance });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to assign grievance.' });
  }
});

// POST /api/grievances/:id/comments (Add comment)
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found.' });
    }

    const isSubmitter = grievance.submitted_by.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isSubmitter && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You are not authorized to comment on this grievance.' });
    }

    const newComment = {
      author: req.user.id,
      author_name: req.user.name,
      author_role: req.user.role,
      message: message.trim(),
      created_at: new Date(),
    };

    if (!grievance.comments) grievance.comments = [];
    grievance.comments.push(newComment);
    await grievance.save();

    // Trigger notification
    try {
      const msgSnippet = message.trim().length > 70 ? `${message.trim().slice(0, 70)}...` : message.trim();
      if (isAdmin) {
        await createNotification({
          recipient: grievance.submitted_by,
          title: `Admin commented on your grievance`,
          message: `${req.user.name}: "${msgSnippet}"`,
          type: 'grievance_comment',
          link_id: grievance._id,
        });
      } else {
        await notifyAdmins({
          title: `New Comment on Grievance`,
          message: `${req.user.name} (${req.user.role.toUpperCase()}): "${msgSnippet}"`,
          type: 'grievance_comment',
          link_id: grievance._id,
        });
      }
    } catch (e) {
      console.warn('Comment notification failed:', e.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      comment: newComment,
      comments: grievance.comments,
    });
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to post comment.' });
  }
});

// PUT /api/grievances/:id (Update grievance while pending)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { description } = req.body;
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found.' });
    }

    const isSubmitter = grievance.submitted_by.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isSubmitter && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You are not authorized to edit this grievance.' });
    }

    if (!isAdmin && grievance.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending grievances can be edited.'
      });
    }

    grievance.description = (description && typeof description === 'string') ? description.trim() : '';
    await grievance.save();

    return res.json({
      success: true,
      message: 'Grievance updated successfully.',
      grievance: {
        id: grievance._id.toString(),
        description: grievance.description,
      }
    });
  } catch (error) {
    console.error('Update grievance error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update grievance.', detail: error.message });
  }
});

// DELETE /api/grievances/:id (Delete grievance while pending)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found.' });
    }

    const isSubmitter = grievance.submitted_by.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isSubmitter && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this grievance.' });
    }

    if (!isAdmin && grievance.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Grievance can only be deleted while it is in pending status.'
      });
    }

    await Grievance.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: 'Grievance deleted successfully.',
    });
  } catch (error) {
    console.error('Delete grievance error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete grievance.', detail: error.message });
  }
});

export default router;
