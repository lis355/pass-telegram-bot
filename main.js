require("dotenv-flow").config();

const ndapp = require("ndapp");

ndapp({
	components: [
		() => new (require("./components/db/DbManager"))(),
		() => new (require("./components/telegram/TelegramBotManager"))()
	],
	onRun: async () => {
		// DEBUG
		app.telegramBotManager.onFindCommand = pattern => {
			const foundEntries = app.dbManager.db.findEntries({ pattern });
			app.log.info(`Found ${foundEntries.length} entries for pattern ${pattern}`);

			return foundEntries.map(entry => entry.title).join(app.os.EOL);
		};
	}
});
