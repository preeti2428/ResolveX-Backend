import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dns from 'dns';

// Fix for Windows DNS ECONNREFUSED on MongoDB Atlas mongodb+srv SRV lookup
if (process.env.NODE_ENV === 'development') {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  } catch (e) {
    // Ignore in environments where setServers is restricted
  }
}

import 'dotenv/config';
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined. Please configure it in your backend/.env file.');
  }

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongooseInstance) => {
      console.log('🍃 MongoDB connected successfully via Mongoose.');
      try {
        await seedDefaultData();
      } catch (seedErr) {
        console.warn('⚠️ Seeding check skipped/failed:', seedErr.message);
      }
      return mongooseInstance;
    }).catch((err) => {
      cached.promise = null;
      cached.conn = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  }

  return cached.conn;
}

export async function seedDefaultData() {
  const { User } = await import('../models/User.js');
  const { Category } = await import('../models/Category.js');
  const { Grievance } = await import('../models/Grievance.js');

  // 1. Remove Faculty category and Seed Categories if empty
  await Category.deleteMany({ name: 'Faculty' });
  const categoryCount = await Category.countDocuments();
  if (categoryCount === 0) {
    const defaultCategories = [
      { name: 'Classroom', allowed_role: 'both' },
      { name: 'Labs', allowed_role: 'cr' },
      { name: 'Cabin Issue', allowed_role: 'teacher' }
    ];
    await Category.insertMany(defaultCategories);
    console.log('✅ Default categories seeded into MongoDB.');
  }

  const salt = bcrypt.genSaltSync(10);
  const adminPass = bcrypt.hashSync('Admin@123', salt);
  const teacherPass = bcrypt.hashSync('Teacher@123', salt);
  const crPass = bcrypt.hashSync('Cr@123', salt);

  // 2. Ensure Default Users for all 4 years exist
  const accountsToEnsure = [
    {
      name: 'Prof. S. R. Sharma (HOD AIML & AI)',
      email: 'admin@aiml.edu',
      password_hash: adminPass,
      role: 'admin',
      department: 'AIML',
      branch: 'AIML',
      year: null,
      section: null,
      is_active: true,
    },
    {
      name: 'Dr. Ananya Roy (Assistant Professor)',
      email: 'teacher@aiml.edu',
      password_hash: teacherPass,
      role: 'teacher',
      department: 'AIML',
      branch: 'AIML',
      year: null,
      section: null,
      is_active: true,
    },
    {
      name: 'Aarav Patel (1st Year CR - AIML Sec A)',
      email: 'cr1@aiml.edu',
      password_hash: crPass,
      role: 'cr',
      department: 'AIML',
      branch: 'AIML',
      year: 1,
      section: 'A',
      is_active: true,
    },
    {
      name: 'Rohan Sen (2nd Year CR - AIML Sec B)',
      email: 'cr2@aiml.edu',
      password_hash: crPass,
      role: 'cr',
      department: 'AIML',
      branch: 'AIML',
      year: 2,
      section: 'B',
      is_active: true,
    },
    {
      name: 'Sneha Reddy (3rd Year CR - AI Sec A)',
      email: 'cr3@aiml.edu',
      password_hash: crPass,
      role: 'cr',
      department: 'AIML',
      branch: 'AI',
      year: 3,
      section: 'A',
      is_active: true,
    },
    {
      name: 'Vikram Malhotra (4th Year CR - AIML Sec A)',
      email: 'cr4@aiml.edu',
      password_hash: crPass,
      role: 'cr',
      department: 'AIML',
      branch: 'AIML',
      year: 4,
      section: 'A',
      is_active: true,
    },
    {
      name: 'Aryan Gupta (General CR - AIML Sec A)',
      email: 'cr@aiml.edu',
      password_hash: crPass,
      role: 'cr',
      department: 'AIML',
      branch: 'AIML',
      year: 3,
      section: 'A',
      is_active: true,
    },
    {
      name: 'Er. Amit Verma (Campus Infrastructure Head)',
      email: 'infra@aiml.edu',
      password_hash: bcrypt.hashSync('Infra@123', salt),
      role: 'infra_head',
      department: 'AIML',
      branch: 'AIML',
      year: null,
      section: null,
      is_active: true,
    },
    {
      name: 'Er. Rajesh Sharma (IT & Systems Infrastructure Head)',
      email: 'it_infra@aiml.edu',
      password_hash: bcrypt.hashSync('ItInfra@123', salt),
      role: 'it_infra_head',
      department: 'AIML',
      branch: 'AIML',
      year: null,
      section: null,
      is_active: true,
    },
    {
      name: 'Er. Manoj Kumar (AC Incharge)',
      email: 'ac_incharge@aiml.edu',
      password_hash: bcrypt.hashSync('AcIncharge@123', salt),
      role: 'ac_incharge',
      department: 'AIML',
      branch: 'AIML',
      year: null,
      section: null,
      is_active: true,
    }
  ];

  for (const acc of accountsToEnsure) {
    const existing = await User.findOne({ email: acc.email });
    if (!existing) {
      await User.create(acc);
    } else {
      // Update year and branch if missing
      if (!existing.year && acc.year) {
        existing.year = acc.year;
        existing.branch = acc.branch;
        await existing.save();
      }
    }
  }

  // Ensure all 32 Official AIML Class Representatives exist with authentic details
  try {
    const { CR_DIRECTORY } = await import('../utils/cr-directory.js');
    for (const cr of CR_DIRECTORY) {
      const existingCR = await User.findOne({ email: cr.email.toLowerCase() });
      if (!existingCR) {
        await User.create({
          name: cr.name,
          email: cr.email.toLowerCase(),
          password_hash: crPass,
          role: 'cr',
          department: cr.department || 'AIML',
          branch: cr.branch || 'AIML',
          year: cr.year,
          semester: cr.semester,
          section: cr.section,
          roll_no: cr.roll_no,
          mobile: cr.mobile,
          gender: cr.gender,
          is_active: true,
        });
      } else {
        existingCR.name = cr.name;
        existingCR.year = cr.year;
        existingCR.semester = cr.semester;
        existingCR.section = cr.section;
        existingCR.branch = cr.branch || 'AIML';
        existingCR.roll_no = cr.roll_no;
        existingCR.mobile = cr.mobile;
        existingCR.gender = cr.gender;
        await existingCR.save();
      }
    }
    console.log('✅ All AIML & AI Department CR profiles verified and synced in MongoDB.');
  } catch (crSeedErr) {
    console.warn('⚠️ CR Directory seeding notice:', crSeedErr.message);
  }

  // Ensure all Faculty profiles exist with authentic details
  try {
    const { FACULTY_DIRECTORY } = await import('../utils/faculty-directory.js');
    for (const faculty of FACULTY_DIRECTORY) {
      const existingFaculty = await User.findOne({ email: faculty.email.toLowerCase() });
      if (!existingFaculty) {
        await User.create({
          name: faculty.name,
          email: faculty.email.toLowerCase(),
          password_hash: teacherPass,
          role: 'teacher',
          department: faculty.department || 'AIML',
          branch: faculty.department || 'AIML',
          is_active: true,
        });
      } else {
        existingFaculty.name = faculty.name;
        existingFaculty.department = faculty.department || 'AIML';
        existingFaculty.branch = faculty.department || 'AIML';
        await existingFaculty.save();
      }
    }
    console.log('✅ All AIML & AI Department Faculty profiles verified and synced in MongoDB.');
  } catch (facultySeedErr) {
    console.warn('⚠️ Faculty Directory seeding notice:', facultySeedErr.message);
  }

  // 3. Ensure all grievances have distinct year, branch, and section
  const allGrievances = await Grievance.find();
  for (let i = 0; i < allGrievances.length; i++) {
    const g = allGrievances[i];
    const targetYear = (i % 4) + 1;
    await Grievance.updateOne(
      { _id: g._id },
      {
        $set: {
          year: targetYear,
          branch: targetYear === 3 ? 'AI' : 'AIML',
          section: targetYear === 2 ? 'B' : 'A'
        }
      }
    );
  }

}

