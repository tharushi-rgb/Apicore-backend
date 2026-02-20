import jwt from 'jsonwebtoken';

// In-memory user store for demo when MongoDB is not available
export const demoUsers = [
  {
    _id: 'demo-user-1',
    fullName: 'Nimal Perera',
    email: 'nimal@example.com',
    password: '$2a$10$CwTycUXWue0Thq9StjUM0uJ8SJFpU.wL.XBl8WA5w/z6y9L4R3H5S', // password: demo1234
    phoneNumber: '0712345678',
    nicNumber: '200012345678',
    role: 'beekeeper',
    district: 'Kegalle',
    preferredLanguage: 'en',
    isActive: true
  },
  {
    _id: 'demo-user-2',
    fullName: 'Helper User',
    email: 'helper@example.com',
    password: '$2a$10$CwTycUXWue0Thq9StjUM0uJ8SJFpU.wL.XBl8WA5w/z6y9L4R3H5S', // password: demo1234
    phoneNumber: '0723456789',
    nicNumber: '199923456789',
    role: 'helper',
    district: 'Kegalle',
    preferredLanguage: 'en',
    isActive: true,
    invitedBy: 'demo-user-1'
  }
];

export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'apicore_secret', {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'apicore_secret');
    
    // For demo, check in-memory users first
    const demoUser = demoUsers.find(u => u._id === decoded.id);
    if (demoUser) {
      req.user = demoUser;
      return next();
    }
    
    // If using MongoDB, fetch from database
    // req.user = await User.findById(decoded.id);
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};
