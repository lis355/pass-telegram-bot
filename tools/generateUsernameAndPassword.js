const casual = require("casual");

module.exports = function generateUsernameAndPassword() {
	return {
		username: casual.username.replace(/[._]/g, ""),
		password: app.tools.generatePassword()
	};
};
