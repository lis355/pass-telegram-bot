const kpio = require("keepass.io");

// const generateUuid = require("./tools/uuid");

const ENTRY_STRINGS = new ndapp.enum({
	"TITLE": "Title",
	"USERNAME": "UserName",
	"PASSWORD": "Password",
	"NOTES": "Notes"
});

class Entry {
	constructor(rawEntry) {
		this.rawEntry = rawEntry;
	}

	getString(name) {
		return this.rawEntry.String.find(str => str.Key === name);
	}

	get title() {
		return this.getString(ENTRY_STRINGS.TITLE).Value;
	}

	set title(value) {
		this.getString(ENTRY_STRINGS.TITLE).Value = value;
	}

	get username() {
		return this.getString(ENTRY_STRINGS.USERNAME).Value;
	}

	set username(value) {
		this.getString(ENTRY_STRINGS.USERNAME).Value = value;
	}

	get password() {
		return this.getString(ENTRY_STRINGS.PASSWORD).Value["_"];
	}

	set password(value) {
		this.getString(ENTRY_STRINGS.PASSWORD).Value["_"] = value;
	}

	get notes() {
		return this.getString(ENTRY_STRINGS.NOTES).Value;
	}

	set notes(value) {
		this.getString(ENTRY_STRINGS.NOTES).Value = value;
	}
}

class PassDB {
	constructor(options) {
		const { databasePath, password, keyfilePath } = options;

		if (!app.fs.existsSync(databasePath)) throw new Error("No database");

		if (!password && !keyfilePath) throw new Error("You must type password or keyfile");

		this.databasePath = databasePath;
		this.password = password;
		this.keyfilePath = keyfilePath;

		this.dirty = false;
	}

	async load() {
		this.db = new kpio.Database();

		if (this.password) {
			this.db.addCredential(new kpio.Credentials.Password(this.password));
		}

		if (this.keyfilePath) {
			this.db.addCredential(new kpio.Credentials.Keyfile(this.keyfilePath));
		}

		await new Promise((resolve, reject) => {
			this.db.loadFile(this.databasePath, err => {
				if (err) return reject(err);

				this.rawDb = this.db.getRawApi().get();

				return resolve();
			});
		});

		this.entries = this.rawDb.KeePassFile.Root.Group.Entry.map(entry => new Entry(entry));

		this.dirty = false;
	}

	async save() {
		if (!this.dirty) return;

		this.db.getRawApi().set(this.rawDb);

		await new Promise((resolve, reject) => {
			this.db.saveFile(this.databasePath, err => {
				if (err) return reject(err);
				return resolve();
			});
		});

		this.dirty = false;
	}

	findEntries(options) {
		let { pattern, caseSensitive } = options;

		if (!caseSensitive) {
			pattern = pattern.toLowerCase();
		}

		return this.entries.filter(entry => {
			let title = entry.title;
			if (!caseSensitive) {
				title = title.toLowerCase();
			}

			return title.includes(pattern);
		});
	}

	addEntry(title, username, pass, notes) {
		// const id = generateUuid();

		this.dirty = true;
	}
}

module.exports = PassDB;
