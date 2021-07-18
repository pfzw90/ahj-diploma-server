const fs = require('fs');

module.exports = function jsonReader(filePath, cb) {
  fs.readFile(filePath, (err, fileData) => {
    if (err) {
      return cb && cb(err);
    }
    try {
      const list = JSON.parse(fileData);
      return cb && cb(null, list);
    } catch (e) {
      return cb && cb(e);
    }
  });
};
