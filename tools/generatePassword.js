const crypto = require("crypto");

function randomInt(n) {
	return crypto.randomInt(0, n);
}

function sample(arr) {
	return arr[randomInt(arr.length)];
}

function insert(str, index, value) {
	return str.substr(0, index) + value + str.substr(index);
}

// Пароль из 12 символов, где есть 1 заглавная буква, 1 символ и 1 число

module.exports = function generatePassword() {
	const LENGTH = 12;
	const ABC = "abcdefghijklmnopqrstuvwxyz";
	const ABC_UPPER_CASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const DIGITS = "0123456789";
	const SYMBOLS = "@#_-+()*!?";

	let password = "";

	for (let i = 0; i < LENGTH - 3; i++) password += sample(ABC);

	password = insert(password, randomInt(password.length), sample(ABC_UPPER_CASE));
	password = insert(password, randomInt(password.length), sample(DIGITS));
	password = insert(password, randomInt(password.length), sample(SYMBOLS));

	return password;
};
