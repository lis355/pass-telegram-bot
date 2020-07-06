const PassDB = require("./PassDB");

module.exports = class DbManager extends ndapp.ApplicationComponent {
	async initialize() {
		await super.initialize();

		this.db = new PassDB({
			databasePath: process.env.DB_PATH,
			keyfilePath: process.env.DB_KEYFILEPATH,
			password: process.env.DB_PASS
		});

		await this.db.load();

		app.log.info(`Total ${this.db.entries.length} entries in ${process.env.DB_PATH}`);
	}
};
