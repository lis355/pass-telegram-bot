const uuid = require("uuid");

// https://stackoverflow.com/questions/6095115/javascript-convert-guid-in-string-format-into-base64?rq=1

const hexlist = "0123456789abcdef";
const b64list = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function guidToBase64(g, le = false) {
	let s = g.replace(/[^0-9a-f]/ig, "").toLowerCase();
	if (s.length !== 32) return "";

	if (le) {
		s = s.slice(6, 8) + s.slice(4, 6) + s.slice(2, 4) + s.slice(0, 2) +
			s.slice(10, 12) + s.slice(8, 10) +
			s.slice(14, 16) + s.slice(12, 14) +
			s.slice(16);
	}

	s += "0";

	let a, p, q;
	let r = "";
	let i = 0;

	while (i < 33) {
		a = (hexlist.indexOf(s.charAt(i++)) << 8) |
			(hexlist.indexOf(s.charAt(i++)) << 4) |
			(hexlist.indexOf(s.charAt(i++)));

		p = a >> 6;
		q = a & 63;

		r += b64list.charAt(p) + b64list.charAt(q);
	}

	r += "==";

	return r;
}

function generateUuid() {
	const id = uuid.v4();
	return guidToBase64(id);
}

module.exports = generateUuid;
