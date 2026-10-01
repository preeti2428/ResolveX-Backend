import express from 'express';
import { Grievance } from '../models/Grievance.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/analytics
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { range = '30d', year: filterYear, branch: filterBranch } = req.query;

    const baseFilter = {};
    if (filterYear && filterYear !== 'all') {
      baseFilter.year = Number(filterYear);
    }
    if (filterBranch && filterBranch !== 'all') {
      baseFilter.branch = filterBranch;
    }

    const allGrievances = await Grievance.find(baseFilter)
      .populate('category_id', 'name allowed_role')
      .populate('submitted_by', 'name role department section year branch')
      .lean();

    const total = allGrievances.length;
    let pending = 0;
    let in_progress = 0;
    let resolved = 0;
    let rejected = 0;

    let totalResolutionTimeMs = 0;
    let resolvedCountWithTime = 0;
    let fastestResolutionHours = null;

    let slaUnder24h = 0;
    let sla1to3Days = 0;
    let slaOver3Days = 0;
    let pendingOver48h = 0;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let submittedToday = 0;
    let resolvedToday = 0;

    const categoryMap = {};
    const yearMap = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const branchMap = { AIML: 0, AI: 0 };
    const roleMap = { cr: 0, teacher: 0 };
    const issueTypeMap = {};

    allGrievances.forEach((g) => {
      if (g.status === 'pending') pending++;
      else if (g.status === 'in_progress') in_progress++;
      else if (g.status === 'resolved') resolved++;
      else if (g.status === 'rejected') rejected++;

      const createdDate = new Date(g.created_at);
      if (createdDate >= startOfToday) {
        submittedToday++;
      }

      if (g.status === 'resolved' && g.resolved_at) {
        const resolvedDate = new Date(g.resolved_at);
        if (resolvedDate >= startOfToday) {
          resolvedToday++;
        }
        const diffMs = resolvedDate - createdDate;
        if (diffMs >= 0) {
          totalResolutionTimeMs += diffMs;
          resolvedCountWithTime++;
          const diffHours = diffMs / (1000 * 60 * 60);

          if (fastestResolutionHours === null || diffHours < fastestResolutionHours) {
            fastestResolutionHours = diffHours;
          }

          if (diffHours <= 24) slaUnder24h++;
          else if (diffHours <= 72) sla1to3Days++;
          else slaOver3Days++;
        }
      }

      if (g.status === 'pending' || g.status === 'in_progress') {
        const ageHours = (now - createdDate) / (1000 * 60 * 60);
        if (ageHours > 48) {
          pendingOver48h++;
        }
      }

      const catName = g.category_id?.name || 'Unassigned';
      if (!categoryMap[catName]) {
        categoryMap[catName] = { total: 0, resolved: 0, pending: 0, in_progress: 0, rejected: 0 };
      }
      categoryMap[catName].total++;
      if (g.status === 'resolved') categoryMap[catName].resolved++;
      if (g.status === 'pending') categoryMap[catName].pending++;
      if (g.status === 'in_progress') categoryMap[catName].in_progress++;
      if (g.status === 'rejected') categoryMap[catName].rejected++;

      const yr = g.year || 1;
      if (yearMap[yr] !== undefined) yearMap[yr]++;

      const br = g.branch || 'AIML';
      if (branchMap[br] !== undefined) branchMap[br]++;

      const r = g.submitted_by?.role || 'cr';
      if (roleMap[r] !== undefined) roleMap[r]++;

      if (g.details && typeof g.details === 'object') {
        const issueType = g.details.issue_type || g.details.room_no || g.details.lab_name;
        if (issueType && typeof issueType === 'string') {
          const key = issueType.trim();
          issueTypeMap[key] = (issueTypeMap[key] || 0) + 1;
        }
      }
    });

    const avgResolutionHours =
      resolvedCountWithTime > 0
        ? Math.round((totalResolutionTimeMs / (resolvedCountWithTime * 1000 * 60 * 60)) * 10) / 10
        : 0;

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    let numDays = 30;
    if (range === '7d') numDays = 7;
    if (range === '14d') numDays = 14;
    if (range === 'all') numDays = 60;

    const timeline = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yearStr}-${monthStr}-${dayStr}`;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const displayLabel = `${monthNames[d.getMonth()]} ${d.getDate()}`;

      let daySubmitted = 0;
      let dayResolved = 0;

      allGrievances.forEach((g) => {
        const cDate = new Date(g.created_at);
        const cKey = `${cDate.getFullYear()}-${String(cDate.getMonth() + 1).padStart(2, '0')}-${String(cDate.getDate()).padStart(2, '0')}`;
        if (cKey === dateKey) daySubmitted++;

        if (g.resolved_at) {
          const rDate = new Date(g.resolved_at);
          const rKey = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}`;
          if (rKey === dateKey) dayResolved++;
        }
      });

      timeline.push({
        date: dateKey,
        label: displayLabel,
        submitted: daySubmitted,
        resolved: dayResolved,
      });
    }

    const categoryStats = Object.keys(categoryMap).map((name) => ({
      name,
      total: categoryMap[name].total,
      resolved: categoryMap[name].resolved,
      pending: categoryMap[name].pending,
      in_progress: categoryMap[name].in_progress,
      percentage: total > 0 ? Math.round((categoryMap[name].total / total) * 100) : 0,
      resolutionRate:
        categoryMap[name].total > 0
          ? Math.round((categoryMap[name].resolved / categoryMap[name].total) * 100)
          : 0,
    })).sort((a, b) => b.total - a.total);

    const topIssues = Object.keys(issueTypeMap)
      .map((type) => ({ type, count: issueTypeMap[type] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return res.json({
      success: true,
      range,
      overview: {
        total,
        pending,
        in_progress,
        resolved,
        rejected,
        active_backlog: pending + in_progress,
        resolution_rate: resolutionRate,
        avg_resolution_hours: avgResolutionHours,
        fastest_resolution_hours:
          fastestResolutionHours !== null ? Math.round(fastestResolutionHours * 10) / 10 : null,
        submitted_today: submittedToday,
        resolved_today: resolvedToday,
        pending_over_48h: pendingOver48h,
      },
      statusDistribution: [
        { label: 'Pending Review', key: 'pending', count: pending, color: '#F59E0B', percentage: total > 0 ? Math.round((pending / total) * 100) : 0 },
        { label: 'Under Repair', key: 'in_progress', count: in_progress, color: '#3B82F6', percentage: total > 0 ? Math.round((in_progress / total) * 100) : 0 },
        { label: 'Resolved', key: 'resolved', count: resolved, color: '#10B981', percentage: total > 0 ? Math.round((resolved / total) * 100) : 0 },
        { label: 'Rejected', key: 'rejected', count: rejected, color: '#EF4444', percentage: total > 0 ? Math.round((rejected / total) * 100) : 0 },
      ],
      timeline,
      categoryStats,
      yearStats: [
        { year: '1st Year', count: yearMap[1], percentage: total > 0 ? Math.round((yearMap[1] / total) * 100) : 0 },
        { year: '2nd Year', count: yearMap[2], percentage: total > 0 ? Math.round((yearMap[2] / total) * 100) : 0 },
        { year: '3rd Year', count: yearMap[3], percentage: total > 0 ? Math.round((yearMap[3] / total) * 100) : 0 },
        { year: '4th Year', count: yearMap[4], percentage: total > 0 ? Math.round((yearMap[4] / total) * 100) : 0 },
      ],
      branchStats: [
        { branch: 'AIML', count: branchMap.AIML, percentage: total > 0 ? Math.round((branchMap.AIML / total) * 100) : 0 },
        { branch: 'AI', count: branchMap.AI, percentage: total > 0 ? Math.round((branchMap.AI / total) * 100) : 0 },
      ],
      roleStats: [
        { role: 'Class Representatives', count: roleMap.cr, percentage: total > 0 ? Math.round((roleMap.cr / total) * 100) : 0 },
        { role: 'Faculty / Teachers', count: roleMap.teacher, percentage: total > 0 ? Math.round((roleMap.teacher / total) * 100) : 0 },
      ],
      slaStats: {
        under_24h: slaUnder24h,
        one_to_three_days: sla1to3Days,
        over_three_days: slaOver3Days,
        total_resolved: resolvedCountWithTime,
      },
      topIssues,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to generate analytics data.' });
  }
});

export default router;
