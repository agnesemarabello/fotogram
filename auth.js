const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;

const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token mancante' });

  jwt.verify(token, secret, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token non valido' });
    req.user = user;
    next();
  });
};

module.exports = auth;
