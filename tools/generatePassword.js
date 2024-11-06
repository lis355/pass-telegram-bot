import crypto from "node:crypto";

function randomInt(n) {
	return crypto.randomInt(0, n);
}

function sample(arr) {
	return arr[randomInt(arr.length)];
}

function insert(str, index, value) {
	return str.substr(0, index) + value + str.substr(index);
}

// Пароль из LENGTH символов, где есть 1 заглавная буква, 1 символ и 1 число

const LENGTH = 16;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const ALPHABET_IN_UPPER_CASE = ALPHABET.toUpperCase();
const DIGITS = "0123456789";
const SYMBOLS = "@#_-+()*!?";

export default function generatePassword() {
	let password = "";

	for (let i = 0; i < LENGTH - 3; i++) password += sample(ALPHABET);

	password = insert(password, randomInt(password.length), sample(ALPHABET_IN_UPPER_CASE));
	password = insert(password, randomInt(password.length), sample(DIGITS));
	password = insert(password, randomInt(password.length), sample(SYMBOLS));

	return password;
}
