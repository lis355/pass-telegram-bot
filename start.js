require("dotenv-flow").config();

const ndapp = require("ndapp");
const service = require("./service/windows/service");

class AppManager extends ndapp.Application {
	constructor() {
		super();

		const errorHandler = error => {
			console.error(error.stack);
		};

		this.onUncaughtException = errorHandler;
		this.onUnhandledRejection = errorHandler;
	}

	get isDevelop() {
		return process.env.DEVELOP === "true";
	}

	async initialize() {
		const { default: ydc } = await import("ydc");
		await ydc();

		await super.initialize();
	}

	async quit(code = 0) {
		if (!app.isDevelop) {
			await new Promise(resolve => {
				service.once("uninstall", resolve);

				service.uninstall();
			})
		}

		await super.quit(code);
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
