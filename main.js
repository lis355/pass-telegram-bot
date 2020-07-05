require("dotenv-flow").config();

const ndapp = require("ndapp");

const PassDB = require("./PassDB");
const TelegramBot = require("./TelegramBot");

ndapp(async () => {
	const db = new PassDB({
		databasePath: process.env.DB_PATH,
		keyfilePath: process.env.DB_KEYFILEPATH,
		password: process.env.DB_PASS
	});

	await db.load();

	app.log.info(`Total ${db.entries.length} entries`);

	const bot = new TelegramBot();
	await bot.initialize();

	// DEBUG
	bot.onFindCommand = pattern => {
		const foundEntries = db.findEntries({ pattern });
		app.log.info(`Found ${foundEntries.length} entries for pattern ${pattern}`);

		return foundEntries.map(entry => entry.title).join(app.os.EOL);
	};
});
