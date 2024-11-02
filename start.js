import dotenv from "dotenv-flow";
import ydc from "ydc";

import Application from "./app/Application.js";
import KeePassDBManager from "./components/KeePassDBManager.js";
import service from "./service/windows/service.js";
import TelegramBotManager from "./components/TelegramBotManager.js";

dotenv.config();

await ydc();

class AppManager extends Application {
	constructor() {
		super();

		this.addComponent(new KeePassDBManager(this));
		this.addComponent(new TelegramBotManager(this));
	}

	get isDevelop() {
		return process.env.DEVELOP === "true";
	}

	async quit(code = 0) {
		if (!this.isDevelop) {
			await new Promise(resolve => {
				service.once("uninstall", resolve);

				service.uninstall();
			});
		}

		await super.quit(code);
	}
}

const app = new AppManager();
await app.initialize();
await app.run();
