const kpio = require("keepass.io");

// const generateUuid = require("./tools/uuid");

class PassDB {
	constructor(options) {
		const { databasePath, password, keyfilePath } = options;

		if (!app.fs.existsSync(databasePath)) throw new Error("No database");

		if (!password && !keyfilePath) throw new Error("You must type password or keyfile");

		this.databasePath = databasePath;
		this.password = password;
		this.keyfilePath = keyfilePath;
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

				this.rawDatabase = this.db.getRawApi().get();

				return resolve();
			});
		});
	}

	async save() {
		this.db.getRawApi().set(this.rawDatabase);

		await new Promise((resolve, reject) => {
			this.db.saveFile(this.databasePath, err => {
				if (err) return reject(err);
				return resolve();
			});
		});
	}

	async addEntry(title, username, pass, notes) {
		// const id = generateUuid();
	}
}

module.exports = PassDB;
