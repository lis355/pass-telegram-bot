require("dotenv-flow").config();

const ndapp = require("ndapp");

ndapp({
	components: [
		() => new (require("./components/LocalDbManager"))(),
		() => new (require("./components/db/DbManager"))(),
		() => new (require("./components/telegram/TelegramBotManager"))()
	],
	onRun: async () => {
	}
});
