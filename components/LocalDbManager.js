const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

module.exports = class LocalDbManager extends ndapp.ApplicationComponent {
	async initialize() {
		await super.initialize();

		const DB_FILE_NAME = "db.json";
		const DB_DEFAULTS = {};

		const dbFileName = app.path.join(process.env.TEMP_PATH, DB_FILE_NAME);
		app.fs.ensureDirSync(app.path.dirname(dbFileName));

		const adapter = new FileSync(dbFileName, {
			serialize: app.tools.json.format,
			deserialize: app.tools.json.parse
		});

		this.db = low(adapter);

		this.db
			.defaultsDeep(DB_DEFAULTS)
			.write();

		app.db = this.db;
	}
};
