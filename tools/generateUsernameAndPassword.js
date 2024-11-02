import casual from "casual";

import generatePassword from "./generatePassword.js";

export default function generateUsernameAndPassword() {
	return {
		username: casual.username.replace(/[._]/g, ""),
		password: generatePassword()
	};
}
