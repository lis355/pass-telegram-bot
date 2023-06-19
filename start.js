require("dotenv-flow").config();

const ndapp = require("ndapp");

class AppManager extends ndapp.Application {
	constructor() {
		super();

		const errorHandler = error => {
			console.error(error.message);
		};

		this.onUncaughtException = errorHandler;
		this.onUnhandledRejection = errorHandler;
	}

	get isDevelop() {
		return process.env.DEVELOP === "true";
	}
}

ndapp({
	app: new AppManager(),
	components: [
		() => new (require("./components/KeePassDBManager"))(),
		() => new (require("./components/TelegramBotManager"))()
	],
	tools: {
		generatePassword: require("./tools/generatePassword"),
		generateUsernameAndPassword: require("./tools/generateUsernameAndPassword")
	}
});
